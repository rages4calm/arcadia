/* Arcadia application logic. No game data here -- that is data.js, which must
   load first because everything below reads its consts. */
"use strict";
/* ═══════════ GAME MODEL ═══════════
   Every ability is scaled by exactly 3 of the 5 offensive attributes.
   Vitality scales no ability — it is survivability, and armour always rolls it.
   ═══════════════════════════════════ */


const curveVal    =(g,p)=> g.lin!=null ? g.lin*p : g.a*p/(p+g.b);
const curveMargin =(g,p)=> g.lin!=null ? g.lin   : g.a*g.b/((p+g.b)**2);
// How saturated an attribute is: 0 = untapped (cheap points), 1 = capped (wasted points)
function saturation(key,p){
  const gs=(ATTRS[key].gives||[]).filter(g=>g.a);
  if(!gs.length||p<=0) return null;
  return gs.reduce((n,g)=>n+p/(p+g.b),0)/gs.length;
}


// Observed itemisation: armour ≈ 0.62×iLvl Vitality + 2 offensive at ≈0.19×iLvl each.










function tagMatches(tag,a){ return !!tag && (a.id===tag || (a.tags||[]).includes(tag)); }
function tagScope(tag){ return ABILITIES.filter(a=>tagMatches(tag,a)); }


















// Slot names as the game uses them. Your weapon goes in ARMS — there is no
// separate weapon slot.


      // always rolls Vitality
 // secondaries only
     // migrate older saves/links





let S = fromHash() || loadState();   // legacy links + stored build, synchronous
// A compressed link can't be read synchronously, so decode it after first paint.
(async()=>{
  if(await loadFromShortLink()) return;          // /b/<id>
  const raw=location.hash.replace(/^#b=/,"");    // #b=c.<payload>
  if(!raw || raw===location.hash || !raw.startsWith("c.")) return;
  const d=await decodeBuildAsync(raw);
  if(d){ S=normalise(d); persist(); render(); }
})();

/* A relic page can hand an ability over: /?ability=pyrosphere slots it into the
   first free slot so the pool you were just reading is actually in the loadout.
   It never displaces a slot you have already filled, and it does not persist --
   arriving from a link should not quietly rewrite the build you had saved.

   This only mutates state. Calling render() here would abort the rest of this
   file: the renderers close over consts declared further down, which are still
   in their temporal dead zone while this line runs, so the throw stops
   evaluation before any event handler is bound. The render at the end of the
   file is what draws this. */
(function adoptAbilityFromQuery(){
  try{
    // Wrapped because this file is also evaluated outside a browser -- the
    // export and verification tools run it in a bare VM, where URLSearchParams
    // does not exist. A throw here would stop the rest of the file from
    // evaluating, which is a large failure for a small convenience.
    if(typeof URLSearchParams!=="function" || typeof location==="undefined") return;
    const want=new URLSearchParams(location.search||"").get("ability");
    if(!want || !ABILITIES.some(a=>a.id===want)) return;
    if(S.loadout.includes(want)) return;
    const free=S.loadout.indexOf("");
    if(free<0) return;
    S.loadout[free]=want;
    const nm=(ABILITIES.find(a=>a.id===want)||{}).name||want;
    addEventListener("load",()=>{ try{ toast(`Added ${nm}`); }catch(e){} });
  }catch(e){ /* never let a query-string nicety break the app */ }
})();

function loadState(){
  try{ const d=JSON.parse(localStorage.getItem(LS)); if(d&&d.gear) return normalise(d); }catch(e){}
  return {loadout:["","","",""], gear:blankGear()};
}
function blankGear(){ const g={}; SLOTS.forEach(s=>g[s]=null); return g; }
function normalise(d){ d.loadout=(d.loadout||["","","",""]).slice(0,4);
  while(d.loadout.length<4) d.loadout.push("");
  d.gear=d.gear||{};
  if(!d.compare) d.compare={slot:"Chest",item:"",rolls:[]};
  if(SLOT_ALIAS[d.compare.slot]) d.compare.slot=SLOT_ALIAS[d.compare.slot];
  Object.keys(SLOT_ALIAS).forEach(old=>{                    // migrate renamed slots
    if(d.gear[old] && !d.gear[SLOT_ALIAS[old]]){ d.gear[SLOT_ALIAS[old]]=d.gear[old]; }
    delete d.gear[old]; });
  SLOTS.forEach(s=>{ if(!(s in d.gear)) d.gear[s]=null; }); return d; }
function persist(){ localStorage.setItem(LS,JSON.stringify(S)); }
function save(){ persist(); render(); }
const clone=o=>JSON.parse(JSON.stringify(o));

// Compact share encoding: indices instead of names keeps links short.

function buildPayload(){
  return {
    l:S.loadout.map(id=>{const i=ABILITIES.findIndex(a=>a.id===id); return i<0?-1:i;}),
    g:SLOTS.map(sl=>{
      const g=S.gear[sl]; if(!g) return 0;
      return [g.item||"", g.lv||0, (g.rolls||[])
        .filter(r=>r.s&&ALLSTATS.indexOf(r.s)>=0)
        .map(r=>[ALLSTATS.indexOf(r.s), r.p?1:0, r.v, r.t?TAG_KEYS.indexOf(r.t)+1:0])];
    })};
}
const b64url = bytes => { let s=""; bytes.forEach(b=>s+=String.fromCharCode(b));
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
const unb64url = str => { const b=atob(str.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(b,c=>c.charCodeAt(0)); };

// Plain base64 of the JSON. Kept as-is so links shared before compression existed
// keep working forever.
function encodeBuildPlain(){
  return b64url(new TextEncoder().encode(JSON.stringify(buildPayload())));
}
// Compressed form, ~half the length. Marked with a "c." prefix; the legacy form
// always begins with base64 of '{"' so the two can never be confused.
async function encodeBuild(){
  const bytes=new TextEncoder().encode(JSON.stringify(buildPayload()));
  if(typeof CompressionStream==="function"){
    try{
      const cs=new CompressionStream("deflate-raw");
      const w=cs.writable.getWriter(); w.write(bytes); w.close();
      const out=new Uint8Array(await new Response(cs.readable).arrayBuffer());
      if(out.length) return "c."+b64url(out);
    }catch(e){ /* fall through to the uncompressed form */ }
  }
  return b64url(bytes);
}
function decodeFromJSON(json){
  try{
    const c=(typeof json==="string")?JSON.parse(json):json;
    const out={loadout:(c.l||[]).map(i=>ABILITIES[i]?ABILITIES[i].id:""), gear:blankGear()};
    (c.g||[]).forEach((e,i)=>{
      const sl=SLOTS[i]; if(!sl||!e) return;
      out.gear[sl]={item:e[0]||"", lv:e[1]||0,
        rolls:(e[2]||[]).map(r=>{const o={s:ALLSTATS[r[0]],p:r[1]?1:0,v:+r[2]||0};
            if(r[3]) o.t=TAG_KEYS[r[3]-1]||"gun"; return o;})
          .filter(r=>r.s)};
    });
    return normalise(out);
  }catch(e){ return null; }
}
// Legacy links decode synchronously (no flash of default state); compressed
// links need async inflate.
function decodeBuild(str){
  try{ return decodeFromJSON(new TextDecoder().decode(unb64url(str))); }
  catch(e){ return null; }
}
async function decodeBuildAsync(str){
  if(!str) return null;
  if(str.startsWith("c.")){
    if(typeof DecompressionStream!=="function") return null;
    try{
      const ds=new DecompressionStream("deflate-raw");
      const w=ds.writable.getWriter(); w.write(unb64url(str.slice(2))); w.close();
      const out=new Uint8Array(await new Response(ds.readable).arrayBuffer());
      return decodeFromJSON(new TextDecoder().decode(out));
    }catch(e){ return null; }
  }
  return decodeBuild(str);
}
function fromHash(){
  const h=location.hash.replace(/^#b=/,'');
  if(!h || h===location.hash) return null;
  return decodeBuild(h);
}
// Try for a short link first (/b/x7k2p) so the URL doesn't look like spam to
// chat auto-moderators. If the API is unreachable, fall back to the long
// self-contained link — sharing must never break just because a server is down.
async function shareLink(force){
  // onclick handlers pass the Event as arg 1 — only an explicit true forces through.
  if(force!==true){
    const miss=emptySecSlots();
    if(miss.length){
      toast(`Unfilled secondary picks on ${miss.join(", ")}`, ()=>shareLink(true), "Share anyway");
      return;
    }
  }
  const code=await encodeBuild();
  const longUrl=location.origin+location.pathname+"#b="+code;
  let url=longUrl, short=false;
  try{
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(),4000);
    const res=await fetch("/api/build.php",{method:"POST",signal:ctl.signal,
      headers:{"Content-Type":"application/json"},body:JSON.stringify({p:code})});
    clearTimeout(timer);
    if(res.ok){
      const j=await res.json();
      if(j&&j.id){ url=location.origin+"/b/"+j.id; short=true; }
    }
  }catch(e){ /* offline, blocked, or no backend — long link still works */ }
  try{
    await navigator.clipboard.writeText(url);
    toast(short?`Short link copied (${url.length} chars)`
                :`Link copied (${url.length} chars) — short links unavailable`);
  }catch(e){
    if(!short) history.replaceState(null,"","#b="+code);
    toast("Link ready in the address bar — copy it");
  }
}
function emptySecSlots(){
  const miss=[];
  SLOTS.forEach(sl=>{
    const g=S.gear[sl]; if(!g) return;
    if((g.rolls||[]).some(r=>!r.p&&!r.s)) miss.push(sl);
  });
  return miss;
}
// Opening /b/x7k2p: fetch the stored build and load it.
async function loadFromShortLink(){
  const m=location.pathname.match(/\/b\/([A-Za-z0-9]{4,12})\/?$/);
  if(!m) return false;
  try{
    const res=await fetch("/api/build.php?id="+encodeURIComponent(m[1]));
    if(!res.ok) throw new Error(res.status);
    const j=await res.json();
    const d=await decodeBuildAsync(j.p||"");
    if(d){ S=normalise(d); persist(); render(); return true; }
    throw new Error("bad payload");
  }catch(e){
    toast("Couldn't load that build link");
    return false;
  }
}
/* An optional `undo` callback turns the toast into the escape hatch for a
   destructive action, which beats a confirm dialog for something you'll do
   often. Announced politely so a screen reader hears it at all. */
function toast(msg,undo,undoLabel){
  const t=document.getElementById("toast");
  t.textContent=msg;
  if(undo){
    const b=document.createElement("button");
    b.className="btn"; b.type="button"; b.textContent=undoLabel||"Undo";
    b.style.marginLeft="11px";
    b.onclick=()=>{ t.classList.remove("on"); undo(); };
    t.appendChild(b);
  }
  t.classList.add("on");
  clearTimeout(toast._t);
  toast._t=setTimeout(()=>t.classList.remove("on"), undo?7000:2600);
}
window.addEventListener("hashchange",async()=>{
  const raw=location.hash.replace(/^#b=/,"");
  if(!raw||raw===location.hash) return;
  const d=await decodeBuildAsync(raw);
  if(d){ S=normalise(d); save(); toast("Loaded build from link"); }
});

/* ═══════════ COMPUTE ═══════════ */
function attrTotals(){
  const t={}; AKEYS.forEach(k=>t[k]=ATTR_BASE);
  SLOTS.forEach(sl=>{const g=S.gear[sl]; if(!g)return;
    (g.rolls||[]).forEach(r=>{ if(r.p&&AKEYS.includes(r.s)) t[r.s]+=(+r.v||0); });});
  return t;
}
function secTotals(){
  const t={}; SLOTS.forEach(sl=>{const g=S.gear[sl]; if(!g)return;
    (g.rolls||[]).forEach(r=>{ if(!r.p&&r.s) t[r.s]=(t[r.s]||0)+(+r.v||0); });}); return t;
}
function equipped(){ return S.loadout.filter(Boolean).map(id=>ABILITIES.find(a=>a.id===id)).filter(Boolean); }
function coverage(){ const c={}; AKEYS.forEach(k=>c[k]=0);
  equipped().forEach(a=>a.by.forEach(k=>c[k]++)); return c; }
/* Tagged rolls and scoped legendary effects only work with abilities carrying that
   tag, so an ability can look weak on attributes while being the only thing making
   your gear function. A Gunner's Pendant and a Double Tap Ring are [Gun]-only: rank
   on attribute points alone and the tool will happily tell you to drop your last
   gun ability and throw both away. Attributes are a tiebreaker here, not the
   measure. */
function listJoin(a){
  if(a.length<2) return a[0]||"";
  return a.slice(0,-1).join(", ")+" and "+a[a.length-1];
}
function abilityGear(a){
  const hits=[];
  SLOTS.forEach(sl=>{
    const g=S.gear[sl]; if(!g) return;
    (g.rolls||[]).forEach(r=>{
      if(r.t && r.s && tagMatches(r.t,a)) hits.push({item:g.item||sl, what:rollLabel(r)});
    });
    if(g.item){
      const fx=fxFor(g.item);
      if(fx && fx.scope && tagMatches(fx.scope,a)) hits.push({item:g.item, what:"legendary effect"});
    }
  });
  return hits;
}
// Would dropping this ability leave that gear with nothing to work on?
function gearOrphanedBy(a){
  const mine=abilityGear(a);
  if(!mine.length) return [];
  const others=S.loadout.filter(id=>id&&id!==a.id)
    .map(id=>ABILITIES.find(x=>x.id===id)).filter(Boolean);
  return mine.filter(h=>!others.some(o=>abilityGear(o).some(k=>k.item===h.item&&k.what===h.what)));
}
function synergy(a,t){ return a.by.reduce((n,k)=>n+t[k],0); }
function maxHP(){ const t=attrTotals(), s=secTotals();
  return HP_BASE + (t.vitality-ATTR_BASE) + (s.health||0); }
/* An item's LEVEL equals the sum of its primary attribute points — verified on every
   item observed. So item level is a fixed attribute BUDGET, and the only thing that
   varies between two items of the same level is how that budget is split. For a damage
   build the useful measure is how much of the budget avoids Vitality. */
function itemBudget(sl){
  const g=S.gear[sl]||null; if(!g) return null;
  const cov=coverage(); let total=0,vit=0,used=0;
  (g.rolls||[]).forEach(r=>{
    if(!r.p||!AKEYS.includes(r.s)) return;
    const v=+r.v||0; total+=v;
    if(r.s==="vitality") vit+=v; else if(cov[r.s]>0) used+=v;
  });
  if(!total) return null;
  return {level:total, vit, offensive:total-vit,
          offShare:Math.round(100*(total-vit)/total),   // quality signal
          used, usedShare:Math.round(100*used/total)};  // scaled by YOUR abilities
}

/* ═══════════ RENDER ═══════════ */
/* An empty planner has nothing worth sharing, so the primary button offers the
   thing that demonstrates the tool instead. Once there's a build, sharing it is
   the action people actually came back for. */
function renderPrimaryAction(){
  const started = hasPrimaries() || S.loadout.some(Boolean);
  const ex=document.getElementById("exampleBtn"), sh=document.getElementById("shareBtn"),
        pub=document.getElementById("pubBtn");
  if(!ex||!sh) return;
  ex.hidden = started; sh.hidden = !started;
  if(pub) pub.hidden = !started;   // nothing to publish until there's a build
}
function render(){ renderLoadout();renderGear();renderAttrs();renderPriority();renderRelics();
  renderAdvice();renderTagged();renderProcs();renderItemDb();renderAbilRank();renderCompare();renderRules();renderDisc();
  renderPrimaryAction(); }


/* ---- item comparison: swap a candidate into one slot and diff everything ---- */
function attrTotalsWith(slot,cand){
  const t={}; AKEYS.forEach(k=>t[k]=ATTR_BASE);
  SLOTS.forEach(sl=>{
    const g = (sl===slot) ? cand : S.gear[sl];
    if(!g) return;
    (g.rolls||[]).forEach(r=>{ if(r.p&&AKEYS.includes(r.s)) t[r.s]+=(+r.v||0); });
  });
  return t;
}
function secTotalsWith(slot,cand){
  const t={};
  SLOTS.forEach(sl=>{ const g=(sl===slot)?cand:S.gear[sl]; if(!g)return;
    (g.rolls||[]).forEach(r=>{ if(!r.p&&r.s) t[r.s]=(t[r.s]||0)+(+r.v||0); });});
  return t;
}
function renderCompare(){
  const C=S.compare||(S.compare={slot:"Chest",item:"",rolls:[]});
  document.getElementById("cmpSlot").innerHTML=
    SLOTS.map(s=>`<option value="${s}" ${s===C.slot?'selected':''}>${s}</option>`).join("");
  const lib=libFor(C.slot);
  const staleNote = ACCESSORY.has(C.slot)
    ? `<div class="note warn">A recent patch adjusted accessory secondary stats. Documented
       ring / neck / belt values here may be out of date &mdash; trust your own tooltip over this
       library for those slots.</div>` : "";
  const nameEl=document.getElementById("cmpName");
  if(nameEl.value!==C.item) nameEl.value=C.item||"";
  const libItem=libByName(C.item);
  const fixedN=libItem?(libItem.rolls||[]).length:0;
  const needsPick=!!(libItem&&libItem.rolledSec);
  const pickNote=needsPick
    ? `<div class="note info secpick-note"><b>Secondary stat pick</b> — extra secondaries on this item are <b>random rolls</b>, not fixed.
       Choose the ones on your piece below (or BiS choices), then set their values.</div>` : "";
  document.getElementById("cmpRolls").innerHTML=(C.rolls||[]).map((r,i)=>{
    const head=needsPick&&i===fixedN?pickNote:"";
    const locked=!!(libItem&&i<fixedN);
    return head+rollRow("__cmp",i,r,needsPick&&i>=fixedN,locked);
  }).join("")+(needsPick&&(C.rolls||[]).length<=fixedN?pickNote:"");

  const out=document.getElementById("cmpOut");
  if(!(C.rolls||[]).length){ out.innerHTML=staleNote+
    `<div class="note">Pick a documented item above, or type a candidate's rolls in, to see whether it beats
      your current <b>${C.slot}</b>. It diffs your attributes, your secondaries and every equipped ability's usable points.
      <br><br><b>${GEAR_LIB.length} items documented so far</b> — a sample gathered from real tooltips, not the full game.
      Anything you type in works just as well.</div>`;
    return; }

  const cur=attrTotals(), nw=attrTotalsWith(C.slot,C);
  const cs=secTotals(),  ns=secTotalsWith(C.slot,C);
  const eq=equipped();

  // attribute deltas
  const arows=AKEYS.filter(k=>nw[k]!==cur[k]).map(k=>{
    const d=nw[k]-cur[k], cls=d>0?'up':'dn';
    return `<div class="k">${ATTRS[k].name}</div><div class="v">${cur[k]}</div>
            <div class="v eqv">→</div><div class="v ${cls}">${nw[k]} (${d>0?'+':''}${d})</div>`;});
  // secondary deltas
  const keys=[...new Set([...Object.keys(cs),...Object.keys(ns)])].filter(k=>(cs[k]||0)!==(ns[k]||0));
  const srows=keys.map(k=>{
    const a=cs[k]||0,b=ns[k]||0,d=b-a,cls=d>0?'up':'dn';
    return `<div class="k">${SEC[k]||k}</div><div class="v">${round(a)}</div>
            <div class="v eqv">→</div><div class="v ${cls}">${round(b)} (${d>0?'+':''}${round(d)})</div>`;});
  // per-ability synergy deltas
  const abr=eq.map(a=>{
    const x=synergy(a,cur), y=synergy(a,nw), d=y-x, cls=d>0?'up':d<0?'dn':'eqv';
    return `<div class="k">${a.name}</div><div class="v">${x}</div>
            <div class="v eqv">→</div><div class="v ${cls}">${y} (${d>0?'+':''}${d})</div>`;});

  const netAbil=eq.reduce((n,a)=>n+(synergy(a,nw)-synergy(a,cur)),0);
  const better=eq.filter(a=>synergy(a,nw)>synergy(a,cur)).length;
  const worse =eq.filter(a=>synergy(a,nw)<synergy(a,cur)).length;
  let cls,msg;
  if(netAbil>0&&worse===0){ cls="good";
    msg=`<b>Clear upgrade.</b> Every equipped ability gains — ${netAbil>0?'+':''}${netAbil} usable attribute points in total.`; }
  else if(netAbil>0){ cls="mixed";
    msg=`<b>Net gain (+${netAbil} points)</b>, but ${worse} of your ${eq.length} abilities lose out while ${better} gain. Worth it if the winners are your main damage.`; }
  else if(netAbil<0&&better===0){ cls="bad";
    msg=`<b>Downgrade.</b> Every equipped ability loses — ${netAbil} usable attribute points overall.`; }
  else { cls="mixed";
    msg=`<b>${netAbil===0?'Even on attributes':'Net loss ('+netAbil+' points)'}</b> — ${better} abilities gain, ${worse} lose. Judge it on the secondary stats below.`; }

  const candFx=fxHtml(fxFor(C.item));
  // The verdict leads. People come here to be told yes or no; the tables are
  // the working, and the working goes underneath the answer.
  out.innerHTML = staleNote
   +`<div class="verdict ${cls}">${msg}</div>`
   +candFx
   +(arows.length?`<div class="dl"><div class="h">Attribute</div><div class="h" style="text-align:right">now</div><div class="h"></div><div class="h" style="text-align:right">with candidate</div>${arows.join("")}</div>`:"")
   +(abr.length?`<div class="dl" style="margin-top:12px"><div class="h">Ability usable points</div><div class="h" style="text-align:right">now</div><div class="h"></div><div class="h" style="text-align:right">after</div>${abr.join("")}</div>`:"")
   +(srows.length?`<div class="note" style="margin-top:12px;font-size:11.5px">Secondary rolls are shown as simple sums. Most stack additively, but a few combine as <code>(flat + attribute) &times; (1 + percent)</code> &mdash; Dot Potency is the confirmed case, which is why it has separate flat and % entries. Trust your in-game panel for the final figure.</div><div class="dl" style="margin-top:12px"><div class="h">Secondary</div><div class="h" style="text-align:right">now</div><div class="h"></div><div class="h" style="text-align:right">after</div>${srows.join("")}</div>`:"")
}

/* fxFor only knows GEAR_LIB. The database carries effects for far more items, and
   an effect is no less real for having come from there. */
function fxAnywhere(name){
  if(!name) return null;
  const direct=fxFor(name); if(direct) return direct;
  const g=libPool().find(x=>tipNorm(x.name)===tipNorm(name));
  return (g&&g.fx)||null;
}

/* Everything on your gear that is aimed at a specific ability rather than at your
   attribute totals: tagged rolls and legendary effects alike. */
function scopedGear(){
  const out=[];
  SLOTS.forEach(sl=>{
    const g=S.gear[sl]; if(!g) return;
    (g.rolls||[]).forEach(r=>{
      if(r.t) out.push({sl, item:g.item||sl, tag:r.t, kind:"roll", label:rollLabel(r)});
    });
    const fx=fxAnywhere(g.item);
    if(fx) out.push({sl, item:g.item||sl, tag:fx.scope||"", kind:"proc",
                     label:`${fx.trigger} → ${fx.effect}`});
  });
  return out;
}

function renderTagged(){
  const eq=equipped(), host=document.getElementById("tagged");
  const rows=scopedGear();
  const filled=SLOTS.filter(sl=>S.gear[sl]&&(S.gear[sl].item||(S.gear[sl].rolls||[]).length));
  const withScoped=new Set(rows.map(r=>r.sl));
  const plain=filled.filter(sl=>!withScoped.has(sl));

  if(!filled.length){
    host.innerHTML=`<div style="color:var(--faint);font-size:12.5px">Add some gear and this shows
      what each piece does for your abilities — tagged rolls like <code>[Gun] +24% Attack Speed</code>
      and legendary effects — rather than what it adds to your attribute totals.</div>`;
    return;
  }

  /* A roll's tag names an ability or a category, so tagMatches is right for it. A
     legendary effect's scope can also be an ELEMENT - "fire" has to find Pyrosphere,
     whose tags are sphere and elemental - so effects go through fxMatches, which
     knows about types. Using one matcher for both told a Pyrosphere build that its
     fire proc had nothing to work with. */
  const hits=r=>{
    if(!r.tag) return eq;
    const f=(r.kind==="proc") ? (a=>fxMatches(r.tag,a)||tagMatches(r.tag,a))
                              : (a=>tagMatches(r.tag,a));
    return eq.filter(f);
  };
  const live=rows.filter(r=>!r.tag || hits(r).length);
  const dead=rows.filter(r=>r.tag && !hits(r).length);

  const summary=`<div class="scoped-sum">`
    +`<b>${withScoped.size} of your ${filled.length} filled slots</b> carry something aimed at an
      ability. The other ${plain.length} give${plain.length===1?"s":""} attributes and secondary stats only.`
    +(plain.length
      ? ` <span class="dim">Raw stats are the easy part to improve — a modifier or effect aimed at
          an ability you actually run is usually the bigger jump, and it is what the
          <i>${plain.map(esc).join(", ")}</i> slot${plain.length>1?"s are":" is"} missing.</span>`
      : ` <span class="dim">Every filled slot is doing something for a specific ability, which is
          what a finished build looks like.</span>`)
    +`</div>`;

  const row=(r,isDead)=>{
    const all=(r.kind==="proc")
      ? ABILITIES.filter(a=>fxMatches(r.tag,a)||tagMatches(r.tag,a))
      : tagScope(r.tag);
    const mine=hits(r);
    const who = !r.tag ? `every ability`
      : mine.length ? mine.map(a=>esc(a.name)).join(", ")
      : `nothing you have equipped <span class="dim">(covers ${all.map(a=>esc(a.name)).join(", ")||"—"})</span>`;
    return `<div class="arow ${isDead?'':'eq'}" style="${isDead?'border-color:#5d3a3f;background:#20121a':''}">
      <span class="ty">${r.kind==="proc"?"effect":"roll"}</span>
      <span class="nm">${esc(r.label)}</span>
      <span class="by" style="color:${isDead?'var(--red)':'var(--cyan)'}">${who}</span>
      <span class="dim" style="font-size:11px">${esc(r.item)}</span></div>`;
  };

  host.innerHTML=summary
    +(live.length?`<div class="scoped-h">Working</div>`+live.map(r=>row(r,false)).join(""):``)
    +(dead.length?`<div class="scoped-h bad">Doing nothing — no equipped ability has that tag</div>`
        +dead.map(r=>row(r,true)).join(""):``);
}
/* Relics are run-time picks that grant temporary buffs, so they deliberately do not
   feed the stat maths - a 5s buff is not a build stat. What they are good for is
   answering "what can I be offered", which depends entirely on the equipped
   loadout, and flagging the two things people actually hunt: damage-over-time
   lines and element conversions. */
function relicCount(r){ return Object.keys(r.b||{}).length + (r.s||[]).length; }
function relicTags(o){
  let t="";
  if(o.dot)  t+=`<span class="rtag dot">DoT</span>`;
  if(o.conv) t+=`<span class="rtag conv">&rarr; ${esc(o.conv)}</span>`;
  return t;
}
function relicBlock(id){
  const r=RELICS[id]; if(!r) return "";
  const ab=ABILITIES.find(a=>a.id===id);
  const equipped=S.loadout.includes(id);
  const branches=Object.keys(r.b||{}).map(bn=>{
    const b=r.b[bn];
    return `<div class="relic-br"><div class="bn">${esc(bn)}${relicTags(b)}</div>
      <ol>${b.t.map(x=>`<li>${esc(x)}</li>`).join("")}</ol></div>`;
  }).join("");
  const solo=(r.s||[]).length
    ? `<div class="relic-sa"><div class="bn">Standalone</div><ul>${
        r.s.map(x=>`<li>${esc(x.t)}${relicTags(x)}</li>`).join("")}</ul></div>`
    : "";
  return `<details class="relic-ab">
    <summary><span class="an">${esc(ab?ab.name:id)}</span>
      ${equipped?`<span class="eq">equipped</span>`:``}
      <span class="ac">${relicCount(r)} relics</span></summary>
    <div class="relic-in">${branches}${solo}</div></details>`;
}



function buildThemes(){
  const sec=secTotals(), out=[];
  for(const t of RELIC_THEMES){
    const v=t.stats.reduce((n,s)=>n+(+sec[s]||0),0);
    if(v>0) out.push({...t, why:`your gear has ${Math.round(v*10)/10} ${SEC[t.stats[0]]||t.stats[0]}`});
  }
  for(const e of RELIC_ELEMENTS){
    const v=e.stats.reduce((n,s)=>n+(+sec[s]||0),0);
    if(v>0) out.push({...e, name:e.k.toLowerCase()+" damage",
                      why:`your gear boosts ${e.k.toLowerCase()} damage`, element:e.k});
  }
  /* A proc that fires on crit makes crit worth more than the raw stat suggests, and
     one scoped to an element or an ability makes that a theme even with no gear
     behind it yet. This is where the legendary work pays off. */
  for(const sl of SLOTS){
    const g=S.gear[sl]; if(!g||!g.item) continue;
    const fx=fxFor(g.item); if(!fx) continue;
    const trig=String(fx.trigger||"").toLowerCase();
    if(/crit/.test(trig) && !out.some(t=>t.k==="crit"))
      out.push({k:"crit", name:"critical strikes", want:/\bcrit(ical)?\b/i,
                why:`${g.item} procs on a critical strike`});
    if(/heavy/.test(trig) && !out.some(t=>t.k==="heavy"))
      out.push({k:"heavy", name:"heavy hits", want:/\bheavy hit/i,
                why:`${g.item} procs on a heavy hit`});
    const sc=String(fx.scope||"").toUpperCase();
    const el=RELIC_ELEMENTS.find(e=>e.k===sc);
    if(el && !out.some(t=>t.element===el.k))
      out.push({...el, name:el.k.toLowerCase()+" damage", element:el.k,
                why:`${g.item}'s effect is ${el.k.toLowerCase()}`});
  }
  return out;
}

function relicAdvice(){
  const themes=buildThemes();
  /* One element is the build's; the rest are incidental rolls. Recommending a
     conversion to anything else would tell a fire build to go physical. */
  const sec=secTotals();
  let domElement=null, domV=0;
  for(const e of RELIC_ELEMENTS){
    const v=e.stats.reduce((n,st)=>n+(+sec[st]||0),0);
    if(v>domV){ domV=v; domElement=e.k; }
  }
  const mine=S.loadout.filter(id=>id&&RELICS[id]);
  const good=[], bad=[];
  if(!themes.length || !mine.length) return {themes, good, bad, mine};

  for(const id of mine){
    const abName=(ABILITIES.find(a=>a.id===id)||{}).name||id;
    const r=RELICS[id];
    const entries=[];
    for(const bn in (r.b||{})) entries.push({label:bn, text:(r.b[bn].t||[]).join(" "), meta:r.b[bn]});
    for(const s of (r.s||[]))   entries.push({label:s.t, text:s.t, meta:s});

    for(const e of entries){
      const hits=[], warns=[];
      for(const t of themes){
        if(t.anti && t.anti.test(e.text)) warns.push(t);
        else if(t.want && t.want.test(e.text)) hits.push(t);
      }
      // A conversion is only good if you have gear for the element it converts TO.
      if(e.meta.conv){
        const has=e.meta.conv===domElement;
        if(has) hits.push({name:e.meta.conv.toLowerCase()+" conversion",
                           why:`converts to ${e.meta.conv.toLowerCase()}, the element your gear backs hardest`});
        else if(themes.some(t=>t.element))
          warns.push({name:"element mismatch",
                      why:`converts to ${e.meta.conv.toLowerCase()}, which none of your gear boosts`});
      }
      if(e.meta.dot && themes.some(t=>t.k==="dot"))
        hits.push({name:"damage over time", why:"applies damage over time, which your DoT Potency scales"});

      if(warns.length) bad.push({ab:abName, abId:id, label:e.label,
        why:warns[0].antiWhy||warns[0].why||`fights your ${warns[0].name}`});
      else if(hits.length>=2) good.push({ab:abName, abId:id, label:e.label, n:hits.length,
                                         why:hits.slice(0,2).map(h=>h.why||h.name).join("; ")});
    }
  }
  good.sort((a,b)=>b.n-a.n);
  return {themes, good:good.slice(0,8), bad:bad.slice(0,5), mine};
}

function renderRelicAdvice(){
  const {themes,good,bad,mine}=relicAdvice();
  if(!mine.length) return "";
  if(!themes.length)
    return `<div class="radv"><h3>Worth grabbing</h3>
      <p class="lead">Add some gear above and this will rank your relic pools against
      what your build actually scales on.</p></div>`;
  const chips=themes.slice(0,7).map(t=>`<span class="theme">${esc(t.name)}</span>`).join("");
  return `<div class="radv">
    <h3>Worth grabbing</h3>
    <p class="lead">Read off your gear, this build leans on: ${chips}</p>
    ${good.length?`<ul>${good.map(g=>
      `<li><a class="ab" href="/relic/${esc(itemSlug(g.ab))}">${esc(g.ab)}</a> — ${esc(g.label)}<br>
        <span class="why">${esc(g.why)}</span></li>`).join("")}</ul>`
      : `<p class="lead">Nothing in your pools lines up strongly with this gear yet.</p>`}
    ${bad.length?`<div class="bad"><h3>Reads like an upgrade, is not</h3><ul>${bad.map(b=>
      `<li><a class="ab" href="/relic/${esc(itemSlug(b.ab))}">${esc(b.ab)}</a> — ${esc(b.label)}<br>
        <span class="why">${esc(b.why)}</span></li>`).join("")}</ul></div>`:``}
  </div>`;
}
function renderRelics(){
  const box=document.getElementById("relicBody"); if(!box) return;
  const all=(document.getElementById("relicAll")||{}).checked;
  const mine=S.loadout.filter(id=>id&&RELICS[id]);
  const ids=all ? Object.keys(RELICS).sort((a,b)=>{
                    const A=S.loadout.includes(a), B=S.loadout.includes(b);
                    if(A!==B) return A?-1:1;
                    const an=(ABILITIES.find(x=>x.id===a)||{}).name||a;
                    const bn=(ABILITIES.find(x=>x.id===b)||{}).name||b;
                    return an.localeCompare(bn);
                  })
                : mine;
  if(!ids.length){
    box.innerHTML=`<div class="hint">Pick an ability or weapon above and its relic pool appears here.</div>`;
    return;
  }
  box.innerHTML=renderRelicAdvice()+ids.map(relicBlock).join("");
}

function renderLoadout(){
  document.getElementById("loadout").innerHTML=[0,1,2,3].map(i=>{
    const cur=S.loadout[i]||"";
    return `<select class="pick" aria-label="Ability slot ${i+1}" onchange="setLoadout(${i},this.value)">`+
      `<option value="">— empty slot ${i+1} —</option>`+
      ABILITIES.map(a=>`<option value="${a.id}" ${a.id===cur?"selected":""}>${a.name}</option>`).join("")+
      `</select>`;
  }).join("");
}
function renderAttrs(){
  const t=attrTotals(),cov=coverage(),eqN=equipped().length,max=Math.max(...Object.values(t),1);
  document.getElementById("attrs").innerHTML=AKEYS.map(k=>{
    const A=ATTRS[k],v=t[k],c=cov[k];
    const col=A.role==="def"?"var(--def)":A.role==="hyb"?"var(--hyb)":"linear-gradient(90deg,var(--acc),var(--acc2))";
    return `<div class="attr ${c>0?'used':'unused'}">
      <div class="cov c${Math.min(c,4)}">${A.role==="def"?"def":c+"/"+(eqN||0)}</div>
      <div class="k">${A.name}</div><div class="val">${v}</div>
      <div class="bar"><i style="width:${100*v/max}%;background:${col}"></i></div></div>`;
  }).join("");
  const hp=maxHP(), t2=attrTotals();
  document.getElementById("hpNote").className="note info";
  document.getElementById("hpNote").innerHTML=
    `<b>Max HP ≈ ${hp}</b> (100 base + ${t2.vitality-1} Vitality${secTotals().health?" + "+secTotals().health+" gear":""}). `+
    `Vitality scales no ability, but <b>armour always rolls it as its largest primary</b> — it isn't a stat you trade away. `+
    `High HP mostly signals <b>high item level</b>, and higher item level raises your offensive attributes too.`;
}
function renderPriority(){
  const t=attrTotals(),cov=coverage(),eq=equipped();
  const host=document.getElementById("priority"),note=document.getElementById("priNote");
  if(!eq.length){ host.innerHTML=`<div style="color:var(--faint);font-size:12.5px">Pick your abilities above to get a ranking.</div>`;
    note.innerHTML=`<b>Start here:</b> pick the abilities you actually run, above. Every ability is scaled by
      exactly 3 of the 5 offensive attributes, so your loadout decides which stats are worth chasing —
      and <b>Vitality scales none of them</b>.`; return; }
  if(!hasPrimaries()){
    host.innerHTML=`<div class="empty">Your abilities are set. Now add gear below — the ranking
      needs your actual attribute values to tell you which stats are worth chasing.</div>`;
    note.innerHTML=`Attributes are ranked by how many of <b>your</b> abilities use them, and how
      much headroom each one still has.`;
    return;
  }
  const ranked=AKEYS.map(k=>({k,cov:cov[k],v:t[k]})).sort((a,b)=>b.cov-a.cov||a.v-b.v);
  host.innerHTML=ranked.map((r,i)=>{
    const A=ATTRS[r.k];
    const tag=r.cov===0?`<span class="tag t-def">survivability</span>`
      :`<span class="tag ${A.role==='def'?'t-def':A.role==='hyb'?'t-hyb':'t-off'}">${r.cov}/${eq.length} abilities</span>`;
    const p=r.v-ATTR_BASE, sat=saturation(r.k,p);
    const satTag = sat===null ? "" :
      `<span class="tag ${sat>0.66?'t-def':sat>0.4?'t-hyb':'t-off'}" title="how far along the diminishing-returns curve">${Math.round(sat*100)}% saturated</span>`;
    const fx=A.gives.map(g=>{
      if(g.lin!=null) return `<b>+${round(g.lin*p)}</b> ${g.s}`;
      if(g.a) return `<b>+${round(curveMargin(g,p))}${g.unit||''}</b>/pt now · ${g.s}`;
      return `<span style="color:var(--faint)">${g.s}</span>`;
    }).join(" · ");
    return `<div class="pri"><span class="p">${i+1}</span><span class="nm">${A.name}</span>${satTag}${tag}<span class="v">${r.v}</span></div>
      <div class="fx">${fx}</div>`;}).join("");
  const top=ranked.find(r=>r.cov>0);
  const sats=AKEYS.map(k=>({k,s:saturation(k,t[k]-ATTR_BASE)})).filter(x=>x.s!==null)
    .sort((a,b)=>b.s-a.s);
  const worst=sats[0];
  note.innerHTML=top?`<b>${ATTRS[top.k].name}</b> scales ${top.cov} of your ${eq.length} abilities and you're at <b>${top.v}</b> — best return per point. Prefer armour that rolls it alongside the unavoidable Vitality.`
    +`<br><br><b>Percentage stats have diminishing returns</b> (<code>y = a·p/(p+b)</code>), so a low
      attribute is worth far more per point than a high one — the 1st point of a stat can be
      <b>5&times;</b> the 34th. That's why the ranking favours stats you're light on.`
    +(worst&&worst.s>0.5?` <b>${ATTRS[worst.k].name}</b> is ~${Math.round(worst.s*100)}% saturated — extra points there do little.`:``)
    +` Flat stats (Max Health, Regen) stay linear and never saturate.`
    :`None of your attributes scale your chosen abilities yet.`;
}
function renderAdvice(){
  const t=attrTotals(),cov=coverage(),eq=equipped();
  const host=document.getElementById("advice");
  if(!eq.length){ host.innerHTML=`<li>Pick your abilities to generate advice.</li>`; return; }
  const tips=[];

  // 1) item level is the master lever
  const lv=SLOTS.filter(sl=>!ACCESSORY.has(sl)).map(sl=>S.gear[sl]&&S.gear[sl].lv).filter(x=>x>0);
  if(lv.length){
    const lo=Math.min(...lv), hi=Math.max(...lv);
    const slot=SLOTS.find(sl=>S.gear[sl]&&S.gear[sl].lv===lo);
    const gain=Math.round(SCALE.off*(hi-lo));
    if(hi-lo>=8&&gain>=1) tips.push({t:`Level up your ${slot} (iLvl ${lo}, lowest you have)`,
      w:`Bringing it to iLvl ${hi} would add roughly +${gain} to each of its two offensive attributes (and ~+${Math.round(SCALE.vit*(hi-lo))} Vitality). Item level raises every stat at once — it's the single biggest lever.`});
  }
  // 2) top lever
  const ranked=AKEYS.map(k=>({k,cov:cov[k],v:t[k]})).filter(r=>r.cov>0).sort((a,b)=>b.cov-a.cov||a.v-b.v);
  if(ranked.length){ const r=ranked[0];
    tips.push({t:`Prioritise ${ATTRS[r.k].name} on new armour`,
      w:`It scales ${r.cov}/${eq.length} of your abilities and you're only at ${r.v}. Armour rolls Vitality plus two offensive stats — aim for pieces where ${ATTRS[r.k].name} is one of the two. Gives ${ATTRS[r.k].gives.map(g=>g.s).join(", ")}.`});}
  // 3) starved attribute an equipped ability needs
  const starved=AKEYS.filter(k=>cov[k]>0&&t[k]<=3);
  if(starved.length){
    const who=starved.map(k=>{const users=eq.filter(a=>a.by.includes(k)).map(a=>a.name);
      return `<b>${ATTRS[k].name}</b> (${t[k]}) — needed by ${users.join(", ")}`;});
    tips.push({t:`Starved attribute${starved.length>1?'s':''}`,
      w:`${who.join("; ")}. Nothing in your gear supplies ${starved.length>1?'them':'it'}, so ${starved.length>1?'those abilities are':'that ability is'} running on close to nothing.`});
  }
  // 4) mismatched ability + concrete replacement
  if(eq.length>1){
    const sc=eq.map(a=>({a,s:synergy(a,t)})).sort((x,y)=>x.s-y.s);
    const worst=sc[0],best=sc[sc.length-1];
    const orphaned=gearOrphanedBy(worst.a);
    if(orphaned.length){
      // Attributes say drop it; the gear says otherwise, and the gear is louder.
      const items=[...new Set(orphaned.map(o=>o.item))];
      tips.push({t:`${worst.a.name} scores low on stats, but your gear is built around it`,
        w:`On attributes alone it only uses ${worst.s} points, against ${best.s} for ${best.a.name} — but
           ${listJoin(items.map(i=>`<b>${esc(i)}</b>`))} carr${items.length>1?"y":"ies"}
           ${listJoin(orphaned.map(o=>`<i>${esc(o.what)}</i>`))}, which
           ${orphaned.length>1?"work":"works"} with nothing else you have equipped.
           Drop ${worst.a.name} and ${orphaned.length>1?"those go":"that goes"} to waste.
           A modifier aimed at one ability is usually worth more than a few attribute points.`});
    } else if(best.s>worst.s*1.3){
      /* Only suggest a swap that does not strand tagged gear, and prefer a candidate
         your gear already boosts over one that merely reads higher on attributes. */
      const cands=ABILITIES.filter(x=>!S.loadout.includes(x.id))
        .map(x=>({x, s:synergy(x,t), g:abilityGear(x).length}))
        .sort((p,q)=>(q.g-p.g)||(q.s-p.s));
      const better=cands[0];
      tips.push({t:`${worst.a.name} fits your stats worst`,
        w:`It runs on ${worst.a.by.map(k=>ATTRS[k].name+" ("+t[k]+")").join(" + ")} = ${worst.s} usable points, vs ${best.s} for ${best.a.name}.`
          +(better&&(better.g>0||better.s>worst.s)
            ? ` <b>${better.x.name}</b> (${better.x.type}) would use ${better.s}, running on ${better.x.by.map(k=>ATTRS[k].name).join(" + ")}`
              +(better.g?`, and your gear already carries ${better.g} modifier${better.g>1?"s":""} aimed at it`:``)+`.`
            : ``)});
    }
  }
  // 5) heavy hit synergy
  if(cov.ferocity>0&&cov.focus>0) tips.push({t:`Ferocity + Focus compound`,
    w:`Focus raises Heavy Hit <i>chance</i>, Ferocity raises Heavy Hit <i>damage</i>. Heavy hits double an attack and crit damage has no cap, so stacking both multiplies out.`});
  // 6) tagged rolls that match nothing equipped
  const orphan={};
  SLOTS.forEach(sl=>{const g=S.gear[sl]; if(!g)return;
    (g.rolls||[]).forEach(r=>{ if(r.t && !eq.some(a=>tagMatches(r.t,a))){
      (orphan[r.t]=orphan[r.t]||[]).push(esc(g.item)); }});});
  Object.keys(orphan).forEach(tag=>{
    const scope=tagScope(tag).map(a=>a.name);
    tips.push({t:`[${TAG_NAME[tag]||tag}] rolls are doing nothing`,
      w:`${[...new Set(orphan[tag])].join(", ")} carry [${TAG_NAME[tag]||tag}] modifiers, but none of your equipped abilities have that tag`
        +(scope.length?` — it would apply to ${scope.join(", ")}.`:`.`)});});

  host.innerHTML=tips.length?tips.map(x=>`<li><b>${x.t}</b><span class="why">${x.w}</span></li>`).join("")
    :`<li>No obvious inefficiencies — your gear and abilities line up.</li>`;
}
function hasPrimaries(){
  return SLOTS.some(sl=>S.gear[sl] && (S.gear[sl].rolls||[]).some(r=>r.p&&AKEYS.includes(r.s)&&(+r.v||0)>0));
}
/* Internal ids read like armor_t5_head_lunar_001; show them as "t5 head Lunar" so
   they can be matched against what the game actually displays. */
function prettyItem(id){
  const m=/^(armor|weapon|accessory)_t(\d+)_([a-z]+)_?([a-z]*)/.exec(id);
  if(!m) return id;
  const region=m[4] ? " "+m[4][0].toUpperCase()+m[4].slice(1) : "";
  // Items with no region are distinguished only by a trailing number (belt_001 vs
  // belt_002) — keep it, or two different items render identically.
  const variant=region ? "" : (/_(\d+)$/.exec(id)||[,""])[1].replace(/^0+/,"");
  return `t${m[2]} ${m[3]}${region}${variant?" #"+variant:""}`;
}
/* Loot-table ids read like "farpointBeaconT5ChestMasterTable"; players call it
   Farpoint Beacon T5. Strip the plumbing and space out the camelCase. */
function prettyTable(t){
  if(!t) return "";
  return String(t)
    .replace(/^table_dungeon_chest_/,"").replace(/ChestMasterTable$/,"")
    .replace(/MasterTable$/,"").replace(/_/g," ")
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/\bT(\d)\b/g,"T$1")
    .replace(/^\w/,c=>c.toUpperCase());
}
/* Drop chances run to four decimal places. Below 0.01% a percentage stops meaning
   anything to a reader, so show the odds as 1-in-N instead. */
function dropPct(c){
  if(!c) return "";
  const pct=c*100;
  return pct>=0.1 ? pct.toFixed(2)+"%"
       : `${pct.toFixed(3)}% (about 1 in ${Math.round(1/c).toLocaleString()})`;
}
/* The slug rule is implemented twice: here, for links the app builds, and in
   the exporter that writes items.json. The item page for a name is keyed by
   this, so if one side changes and the other does not, the app produces links
   to pages that do not exist. Change both, together. */
function itemSlug(name){
  return String(name||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .replace(/['\u2019]/g,"")
    .replace(/[^A-Za-z0-9]+/g,"-").replace(/^-+|-+$/g,"").toLowerCase();
}
/* An ability id can appear on more than one item; today the colliding
   rows carry the same effect, so first-match was already right, but this
   prefers the row for this item's own tier and slot so it stays right if
   a future collision differs. */
function procFor(id, iid){
  const rows = PROCS.filter(p => p.id === id);
  if (rows.length <= 1) return rows[0] || null;
  const m = /^(?:armor|weapon|accessory)_(t\d)_([a-z]+)/.exec(iid || "");
  if (m){
    const want = m[1] + " " + m[2];
    const hit = rows.find(p => (p.pat || "").toLowerCase().startsWith(want));
    if (hit) return hit;
  }
  return rows[0];
}

function renderItemDb(){
  const ic=document.getElementById("itemCount");
  if(ic) ic.textContent=Object.keys(ITEM_DB).length;
  const q=(document.getElementById("itemq")?.value||"").toLowerCase().trim();
  const ids=Object.keys(ITEM_DB).filter(id=>{
    if(!q) return true;
    const hay=(id+" "+prettyItem(id)+" "+(ITEM_NAMES[id]||"")).toLowerCase();
    return q.split(/\s+/).every(t=>hay.includes(t));
  }).sort();
  const rows=ids.slice(0,60).map(id=>{
    const it=ITEM_DB[id], nm=ITEM_NAMES[id];
    const prim=Object.entries(it.p||{}).map(([k,v])=>`${ATTRS[k]?ATTRS[k].name:k} ${v}`).join(" · ");
    const leg=(it.r||[]).includes(4);
    // Prefer the plain-English effect from the proc table; the raw ability id is
    // only a fallback for an effect nobody has written a description for yet.
    const known=it.fx?procFor(it.fx.a,id):null;
    const wf=(typeof WIKI_FX!=="undefined")?WIKI_FX[id]:null;
    /* Three states, and they are genuinely different claims. Either we recorded it,
       so the trigger, scope and chance are all real. Or only the wiki documents it,
       so there is a name and a sentence but no chance worth quoting. Or nobody has
       recorded one - which used to print as "carries no effect", asserting an
       absence that had never actually been established. */
    const fx=it.fx
      ? `<div class="fx" style="margin:2px 0 0 8px;color:var(--good)">Legendary: ${wf?`<b>${esc(wf.n)}</b> — `:``}${esc(it.fx.t.replace(/_/g," "))} → ${esc(known?known.effect:it.fx.a.replace(/_/g," "))}${it.fx.s?` [${esc(fxLabel(it.fx.s))}]`:""}${it.fx.c!=null?` ${it.fx.c}%`:""}</div>`
      : wf
        ? `<div class="fx" style="margin:2px 0 0 8px;color:var(--good)">Legendary: <b>${esc(wf.n)}</b> — ${esc(wf.d)} <span style="color:var(--faint)">(community wiki; proc chance unrecorded)</span></div>`
        : (leg?`<div class="fx" style="margin:2px 0 0 8px;color:var(--faint)">No legendary effect recorded for this one yet</div>`:``);
    return `<div class="arow">
        <span class="nm"><a href="/item/${esc(itemSlug(nm||prettyItem(id)))}"
          title="Open the page for this item">${esc(nm||prettyItem(id))}</a>${nm?` <span class="hint">${esc(prettyItem(id))}</span>`:``}</span>
        <span class="ty">${it.lvl?"iLvl "+it.lvl:""}</span>
        <span class="by">${(it.r||[]).length?"rarity "+it.r.join("/"):""}</span>
      </div>
      ${prim?`<div class="fx" style="margin:-2px 0 0 8px">${esc(prim)}</div>`:``}
      ${(it.sec||[]).length?`<div class="fx" style="margin:2px 0 0 8px;color:var(--faint)">rolls: ${it.sec.map(s=>esc(SEC[s]||s)).join(", ")}</div>`:``}
      ${HIDDEN_STATS[id]?`<div class="fx" style="margin:2px 0 0 8px;color:var(--warn,#e0a030)">hidden from the tooltip: ${esc(HIDDEN_STATS[id])}</div>`:``}
      ${it.d?`<div class="fx" style="margin:2px 0 0 8px;color:var(--cyan)">drops from ${esc(prettyTable(it.d[0]))} &middot; ${dropPct(it.d[1])}</div>`:``}
      ${fx}<div style="height:6px"></div>`;
  }).join("");
  document.getElementById("itemdb").innerHTML = rows ||
    `<div class="fx" style="color:var(--faint)">nothing matches that filter</div>`;
  document.getElementById("itemdbNote").innerHTML =
    `Showing ${Math.min(ids.length,60)} of ${ids.length} matching · ${Object.keys(ITEM_DB).length} items observed.
     <b>Drop chances are the item's chance, not the Legendary's.</b> A loot table decides which item
     drops; rarity is rolled separately, and only a Legendary copy carries a hidden effect. So the
     listed figure is a ceiling - the real odds of a Legendary one are lower by however often
     Legendary rolls. Only the single best source is shown; many items drop from several tables.
     Primaries are <b>fixed</b> per item, so item level never varies. Which secondaries you get
     varies by roll, but their <b>value is set by item level and rarity</b> — an iL83 Legendary
     always shows knockback 33, which is why two different items can share a stat line.
     A missing entry means we haven't observed it, not that it doesn't exist.`;
}

function renderProcs(){
  const eq=equipped();
  const pc=document.getElementById("procCount"); if(pc) pc.textContent=PROCS.length;
  const rows=PROCS.map(p=>{
    // Only a row whose ability id names its target can be matched to your loadout.
    // On the others the tag is the effect's own category, so claiming it "applies
    // to" anything would be inventing a requirement the data doesn't state.
    const mine=p.buffs?(p.scope?eq.filter(a=>fxMatches(p.scope,a)):eq):[];
    const relevant=p.buffs&&(!p.scope||mine.length>0);
    let tail="";
    if(p.buffs&&eq.length){
      tail = mine.length
        ? `· <span style="color:var(--good)">buffs ${mine.map(a=>a.name).join(", ")}</span>`
        : `· <span style="color:var(--faint)">nothing you run carries [${fxLabel(p.scope)}]</span>`;
    }else if(!p.buffs&&p.scope){
      tail = `· <span class="hint">tagged [${fxLabel(p.scope)}] — that's the effect's own type, not a requirement</span>`;
    }
    return `<div class="arow ${relevant&&eq.length?'eq':''}">
      <span class="nm">${esc(p.name||p.pat)}${p.name?` <span class="hint">${esc(p.pat)}</span>`:``}</span>
      <span class="ty">${esc(p.trigger)}</span>
      <span class="by">${p.scope?'['+fxLabel(p.scope)+']':'any build'}</span>
      </div>
      <div class="fx" style="margin:-2px 0 6px 8px">${esc(p.effect)} ${tail}</div>`;
  }).join("");
  document.getElementById("procs").innerHTML = rows +
   `<div class="note">Legendaries carry a triggered effect the tooltip barely hints at — usually
    just a bare <code>[Tag]</code> line with no explanation. Every row above was read off a real
    item, so the trigger, tag and chance are the game's own values rather than a reading of a
    tooltip.
    <b>Only Legendary copies proc.</b> The same base item at a lower rarity has nothing at all —
    across everything observed, no item below Legendary carried an effect, and at Legendary the effect
    never varied between copies (19 items with one, 33 without, no contradictions). So the row
    applies to <i>any Legendary copy</i> of that item, and to no other copy.
    Plenty of Legendaries genuinely have none — every ring and belt observed, and e.g. the
    Necrotic Warrior Boots. A blank means none, not unknown.
    There are five triggers — <b>on crit</b>, <b>on heavy hit</b>, <b>on enemy hit</b>,
    <b>on enemy kill</b> and <b>on impact end</b> (the last fires after 5 hits).
    Where the effect's name says who it buffs, the tag is who it buffs and your abilities are
    matched against it. Elsewhere the tag is the effect's own type — the Dark Yoku Hammer is
    tagged <code>[bomb_explosion]</code> and is a hammer — so it's shown without a claim attached.
    <b>The percentages below are out of date.</b> They were measured before the 2026-07-28 patch,
    when almost every one read 100%. That patch changed trigger rates and nobody has re-measured
    them yet, so read a percentage here as "this item procs" and not as how often. Which item
    carries which effect, and what triggers it, is unaffected - that part is structural.
    <b>Elemental tags are matched on each ability's base element</b> (so <code>[fire]</code> finds
    Pyrosphere) — but most abilities in the game can have their element converted by a relic, so
    that match is a starting point, not a constraint. A Bomb converted to fire counts as fire and
    picks up a <code>[fire]</code> proc that won't be listed against it here. Relics aren't
    modelled, so read every elemental row as the un-converted case and check your own relics.</div>`;
}

function renderAbilRank(){
  const t=attrTotals(),eq=S.loadout.filter(Boolean);
  // With no gear every attribute sits at the base of 1, so all abilities tie and any
  // ranking would be an artefact of sort order rather than a recommendation.
  if(!hasPrimaries()){
    /* No gear means no ranking — every attribute sits at 1, so any order would be an
       artefact of the sort. Base damage and cooldown are fixed properties of the game
       though, true before a single item is equipped, so there is no reason to withhold
       them. They are also the quickest way to spot an ability left in a broken state,
       which is exactly when someone has not built anything yet. */
    const listed=ABILITIES.slice().sort((a,b)=>
      ((ABIL_STATS[b.id]||{}).d||0)-((ABIL_STATS[a.id]||{}).d||0));
    document.getElementById("abilrank").innerHTML=
      `<div class="empty" style="margin-bottom:9px">Add gear with <b>primary</b> attribute rolls and
       these get ranked by how much of your stat spread each one can use. Until then they're listed
       by base damage.</div>`
      + listed.map(a=>{
      const isEq=eq.includes(a.id), st=ABIL_STATS[a.id];
      const weak=st&&st.d!=null&&st.d<ABIL_WEAK;
      return `<div class="arow ${isEq?'eq':''}"><span class="rank">·</span>
        <span class="nm">${a.name}</span>
        ${isEq?'<span class="badge eq">equipped</span>':''}
        <span class="ty">${a.type}</span>
        ${st?`<span class="dmg${weak?" weak":""}" title="${weak?"Far below every other ability — check the latest patch notes":"Base damage per hit"}">${st.d!=null?st.d:"?"}</span><span class="cd">${st.cd!=null?st.cd+"s":""}</span>`:``}
        <span class="by">${a.by.map(k=>k.slice(0,3).toUpperCase()).join("·")}</span></div>`;
    }).join("");
    document.getElementById("abilNote").innerHTML=
      `Each ability is scaled by exactly 3 of the 5 offensive attributes, so which abilities suit
       you depends entirely on the gear you're wearing. The two figures are <b>base damage per hit</b>
       and <b>cooldown</b>, straight from the game — neither changes with your build. A figure in red
       is far below every other ability.`;
    return;
  }
  const rows=ABILITIES.map(a=>({a,s:synergy(a,t)})).sort((x,y)=>y.s-x.s);
  const mx=rows[0]?rows[0].s:1;
  const allTied=rows.length&&rows[0].s===rows[rows.length-1].s;
  const sug=allTied?[]:rows.filter(r=>!eq.includes(r.a.id)).slice(0,2).map(r=>r.a.id);
  document.getElementById("abilrank").innerHTML=rows.map((r,i)=>{
    const isEq=eq.includes(r.a.id),isS=!isEq&&sug.includes(r.a.id);
    return `<div class="arow ${isEq?'eq':''} ${isS?'sug':''}"><span class="rank">${i+1}</span>
      <span class="nm">${r.a.name}</span>
      ${isEq?'<span class="badge eq">equipped</span>':''}${isS?'<span class="badge sug">best on stats</span>':''}
      <span class="ty">${r.a.type}</span>
      ${(()=>{const st=ABIL_STATS[r.a.id]; if(!st) return "";
         // A base damage far below every peer is the most useful thing to notice
         // about an ability, so it is coloured rather than left to be spotted.
         const weak=st.d!=null&&st.d<ABIL_WEAK;
         return `<span class="dmg${weak?" weak":""}" title="${weak?"Far below every other ability — check the latest patch notes":"Base damage per hit"}">${st.d!=null?st.d:"?"}</span>`
               +`<span class="cd">${st.cd!=null?st.cd+"s":""}</span>`;})()}
      <span class="by">${r.a.by.map(k=>k.slice(0,3).toUpperCase()).join("·")}</span>
      <span class="sc" style="color:${r.s>=mx*0.85?'var(--good)':r.s>=mx*0.6?'var(--hl)':'var(--faint)'}">${r.s}</span></div>`;
  }).join("");
  document.getElementById("abilNote").innerHTML=
    `Score = attribute points you own that an ability can actually use (sum of its 3 scaling attributes). `+
    `<b>That is all it measures.</b> It does not count legendary procs, ability-scoped rolls like `+
    `<code>[Gun] +100% Shots Per Tick</code>, or anything else aimed at a single ability — and those are `+
    `frequently worth more than the attributes are. Plenty of strong builds wear gear with mediocre `+
    `attributes purely for a proc, and this ranking cannot see that. It also knows nothing about base `+
    `how an ability actually plays. Treat it as a tiebreaker between abilities your `+
    `gear supports equally, not as a verdict.<br><br>`+
      `The two figures after the damage type are <b>base damage per hit</b> and <b>cooldown</b>, as the `+
      `game reports them. There is deliberately no damage-per-second here: an ability that fires over a `+
      `duration lands many hits per cast, so dividing one by the other would rank a sustained ability `+
      `below a single-hit one. A figure in red is far below every other ability — worth checking the `+
      `patch notes before building around it.`;
}
function renderRules(){
  document.getElementById("itemRules").innerHTML=
    `<b>How gear rolls:</b> <b>Armour</b> (Head/Torso/Feet) always gives Vitality as its largest primary plus <b>2 offensive attributes</b>. `+
    `<b>Arms</b> (your weapon) and <b>Back</b> give offensive attributes only, no Vitality. <b>Accessories</b> (Neck/Rings/Belt) give <b>secondary stats only</b> — no attributes. `+
    `Roughly, armour scales as <code>Vitality ≈ 0.62 × iLvl</code> and <code>each offensive ≈ 0.19 × iLvl</code>. `+
    `Your weapon equips to <b>Arms</b> — there is no separate weapon slot. `+
    `Some legendaries keep unique lines fixed (Link Count, +1 projectile, [Gun] shots per tick, …), but their extra secondaries are <b>random rolls</b>; use <b>Secondary stat pick</b> to enter yours or plan BiS.`;
}





function isPctStat(stat){
  if(!stat) return false;
  if(/_pct$/.test(stat)) return true;
  if(SEC[stat] && /%/.test(SEC[stat])) return true;
  // Shown with "%" on tooltips even when our SEC label is flat / unitless.
  return stat==="aoe_radius" || stat==="dot_potency" || stat==="catch_radius";
}

function typicalPctMid(stat){
  const b=ROLL_BOUNDS[stat];
  if(!b) return 15;
  // Ignore outliers like AoE 200 on a crown when picking a "typical" mid.
  const hi=Math.min(Math.abs(b.max), 60);
  const lo=Math.min(Math.abs(b.min), hi);
  return (lo+hi)/2;
}

/* Pixel font: the "0" in "0%" often reads as "8" (+7.50%→758, +20.50%→…58,
   +5.90%→5.98). Extra glued digit: +5.90%→5.908. */
function snapOcrZeroPct(v){
  const sign=Math.sign(v||1);
  const cents=Math.round(Math.abs(v)*100);
  if(cents%10===8) return sign*((cents-8)/100);
  return Math.round(v*100)/100;
}
function snapOcrPctDecimal(v){
  const sign=Math.sign(v||1);
  let x=Math.abs(v);
  const parts=String(x).split(".");
  if(parts[1] && parts[1].length>=3)
    x=parseFloat(parts[0]+"."+parts[1].slice(0,2));
  return snapOcrZeroPct(sign*x);
}

/* Common Soulbound secondary fractional steps — used to break ties when OCR
   inserted an extra digit (+20.50% → 26058). Includes values seen in GEAR_LIB. */
function ocrPctFracPenalty(v){
  const f=Math.round((Math.abs(v)%1)*100)/100;
  const common=[0,0.05,0.1,0.2,0.25,0.3,0.35,0.5,0.6,0.65,0.75,0.8];
  return common.some(c=>Math.abs(f-c)<0.001)?0:1;
}

/* Pixel zeros / lookalikes: 8|6→0 (+10.50%→1856), 5↔3 (+3.50%→556). */
function ocrDigitConfusions(raw){
  const pairs=[["8","0"],["6","0"],["5","3"]];
  const out=new Set([String(raw)]);
  for(let pass=0; pass<2; pass++){
    for(const s of [...out]){
      for(let i=0;i<s.length;i++){
        for(const [a,b] of pairs){
          if(s[i]===a) out.add(s.slice(0,i)+b+s.slice(i+1));
          if(s[i]===b) out.add(s.slice(0,i)+a+s.slice(i+1));
        }
      }
    }
  }
  return [...out];
}
function ocrZeroRestoreVariants(raw){
  return ocrDigitConfusions(raw);
}

function restoreMangledPctInteger(raw, mid){
  // Last two digits are the hundredths (with 0%→8); leading digits are the
  // whole number, possibly with one extra OCR glyph (+20.50% → 260 + 58).
  // Also try 8/6→0 variants (+10.50% → 1856).
  const cands=[];
  const pushCand=(v, zeros)=>{
    if(v==null || isNaN(v)) return;
    cands.push({v, zeros:zeros||0});
  };
  for(const r0 of ocrZeroRestoreVariants(raw)){
    const zeros=[...raw].filter((ch,i)=>ch!==r0[i]).length;
    const lo=r0.slice(-2);
    let fracDigits=parseInt(lo,10);
    if(isNaN(fracDigits)) continue;
    if(fracDigits%10===8) fracDigits-=8;
    else if(fracDigits%10===6) fracDigits-=6;
    const frac=fracDigits/100;
    const hi=r0.slice(0,-2);
    const pushWhole=h=>{
      if(!h || !/^\d+$/.test(h)) return;
      const whole=parseInt(h,10);
      if(isNaN(whole)) return;
      pushCand(whole+frac, zeros);
    };
    pushWhole(hi);
    for(let i=0;i<hi.length;i++) pushWhole(hi.slice(0,i)+hi.slice(i+1));
    if(r0.length===4) pushCand(parseFloat(r0)/100, zeros);
    if(r0.length===5){
      for(let i=0;i<5;i++){
        const four=r0.slice(0,i)+r0.slice(i+1);
        pushCand(parseFloat(four)/100, zeros);
      }
    }
  }
  const scored=cands
    .map(({v,zeros})=>({c:snapOcrPctDecimal(v), zeros}))
    .filter(x=>!isNaN(x.c) && x.c>=0.5 && x.c<=120)
    .map(x=>({c:x.c, zeros:x.zeros, pen:ocrPctFracPenalty(x.c), dist:Math.abs(x.c-mid)}));
  // Prefer common .XX steps, then more digit restorations, then near typical mid.
  scored.sort((a,b)=>a.pen-b.pen || b.zeros-a.zeros || a.dist-b.dist);
  return scored[0]?scored[0].c:null;
}

/* 3-digit % blobs: +12%→124 / +41%→412 (strip) vs +2.80%→280 / +3.50%→556 (/100
   after 5↔3, 6↔0). Score strip vs /100 across digit-confusion variants. */
function looksLikeDroppedDecimal(raw){
  const last2=parseInt(String(raw).slice(-2),10);
  if(isNaN(last2)) return false;
  const base=last2%10===8?last2-8:last2%10===6?last2-6:last2;
  return [0,5,25,50,65,75,80].includes(last2) || [0,5,25,50,65,75,80].includes(base);
}
function pick3DigitPctRepair(raw, mid){
  const scored=[];
  const decimalish=looksLikeDroppedDecimal(raw);
  const push=(c, zeros)=>{
    if(c==null || isNaN(c) || c<0.5 || c>120) return;
    const v=snapOcrPctDecimal(c);
    // When the last two digits look like hundredths (.50/.80/…), a large
    // strip (556→55) is usually wrong — prefer /100 restorations (+3.50%).
    const band=(decimalish && v>=40)?1:0;
    scored.push({c:v, zeros:zeros||0, pen:ocrPctFracPenalty(v), band,
                 dist:Math.abs(v-mid)});
  };
  for(const r of ocrDigitConfusions(raw)){
    const zeros=[...String(raw)].filter((ch,i)=>ch!==r[i]).length;
    push(parseFloat(r.slice(0,-1)), zeros);
    push(parseFloat(r)/100, zeros);
  }
  scored.sort((a,b)=>{
    if(a.pen!==b.pen) return a.pen-b.pen;
    if(a.band!==b.band) return a.band-b.band;
    // Prefer an unedited reading when it's already a clean common step
    // (252→25 over confusion 232→23), but allow edits when needed (556→3.50).
    const aClean=(a.zeros===0 && a.pen===0 && a.band===0)?0:1;
    const bClean=(b.zeros===0 && b.pen===0 && b.band===0)?0:1;
    if(aClean!==bClean) return aClean-bClean;
    return a.dist-b.dist || a.zeros-b.zeros;
  });
  return scored[0]?scored[0].c:null;
}

function sanitizeOcrValue(stat, value, hadPct){
  // Kept for known pixel-font failure modes; prefer better preprocess + closed-set
  // label matching over growing this further (DoE lesson).
  const v=+value;
  if(!stat || isNaN(v)) return {v:0, flagged:true, note:"couldn't read a number"};

  const raw=String(Math.abs(v));
  const sign=Math.sign(v||1);
  const mid=typicalPctMid(stat);

  // % present (or OCR ":" for %) but decimal lost: +20.50% → 2050 / 26058, or
  // +2.80% → 280.
  if(isPctStat(stat) && hadPct && /^\d+$/.test(raw) && raw.length>=3){
    const pick=raw.length>=4
      ? restoreMangledPctInteger(raw, mid)
      : pick3DigitPctRepair(raw, mid);
    if(pick!=null && !isNaN(pick))
      return {v:Math.round(pick*sign*100)/100, flagged:false, fixed:true, was:v,
        note:`corrected from OCR ${v} (mangled % decimal)`};
  }

  // Primary signal: % secondary whose OCR line has no "%". The glyph was eaten
  // into the number — trailing digit (+12%→+124, +41%→+412), and sometimes the
  // decimal vanishes too (+7.50%→+758, +2.80%→+280, +20.50%→+2050).
  if(isPctStat(stat) && !hadPct && /^\d+$/.test(raw) && raw.length>=2){
    const strip=parseFloat(raw.slice(0,-1));
    const d10=Math.abs(v)/10;
    let pick=null;
    if(raw.length>=4){
      pick=snapOcrZeroPct(Math.abs(v)/100);
    }else if(raw.length===3){
      pick=pick3DigitPctRepair(raw, mid);
    }else{
      // 2 digits: % usually vanished cleanly (keep 12, 41). Only /10 when the
      // integer is too large for a real % roll (8.8%→88, 7.5%→75).
      if(Math.abs(v)<=55) return {v, flagged:false};
      pick=snapOcrZeroPct(d10);
    }
    if(!isNaN(pick) && Math.abs(pick)>=0.5 && Math.abs(pick)<=120)
      return {v:Math.round(pick*sign*100)/100, flagged:false, fixed:true, was:v,
        note:`corrected from OCR ${v} (% missing on a % stat)`};
  }

  // Weak secondary: refuse only values absurd even as a merged stack.
  const b=ROLL_BOUNDS[stat];
  const singleHi=b?Math.max(Math.abs(b.max)*1.35, Math.abs(b.max)+4)
                  :(AKEYS.includes(stat)?140:80);
  if(stat!=="threat" && Math.abs(v)>Math.max(singleHi*5, 300))
    return {v, flagged:true, note:`OCR ${v} is implausibly high even as stacked lines`};

  // Decimal kept but trailing 0→8 (+5.90%→5.98) or % glued as extra digit
  // (+5.908). Do not change a plausible whole digit (3.50 → 4.50) here;
  // plausible neighbours are presented for manual confirmation in the preview.
  if(isPctStat(stat) && !/^\d+$/.test(raw)){
    const snapped=snapOcrPctDecimal(v);
    if(snapped!==v && Math.abs(snapped-v)<1.05+Math.abs(v)*0.02)
      return {v:snapped, flagged:false, fixed:true, was:v,
        note:`corrected from OCR ${v} (0%→8 / extra decimal digit)`};
  }
  return {v, flagged:false};
}

/* Plausible one-glyph alternatives for Soulbound's pixel font. These are hints,
   never automatic replacements: 48 may really be 48, or its 8 may be a 0. */
function plausibleOcrAlternatives(stat, value){
  const v=+value;
  if(!stat || !isFinite(v) || !v) return [];
  const sign=Math.sign(v);
  const raw=String(Math.abs(v));
  const swaps={8:["0"],0:["8","6"],3:["5"],5:["3"],6:["0"]};
  const out=new Set();
  for(let i=0;i<raw.length;i++){
    const reps=swaps[raw[i]]||[];
    for(const ch of reps){
      const s=raw.slice(0,i)+ch+raw.slice(i+1);
      if(!/^\d+(?:\.\d+)?$/.test(s)) continue;
      const n=Math.round(parseFloat(s)*sign*1000)/1000;
      if(!isFinite(n) || n===v || n===0) continue;
      const b=ROLL_BOUNDS[stat];
      const max=b?Math.max(Math.abs(b.max)*1.5,Math.abs(b.max)+5)
                 :(AKEYS.includes(stat)?140:150);
      if(Math.abs(n)<=max) out.add(n);
    }
  }
  // A split decimal can lose/misread its whole digit ("2.50" vs "3.50").
  // Keep both neighbours as suggestions; never select one automatically.
  if(isPctStat(stat) && raw.includes(".")){
    const abs=Math.abs(v), whole=Math.floor(abs);
    const frac=Math.round((abs-whole)*100)/100;
    if([0,0.25,0.5,0.8].includes(frac)){
      if(whole>0) out.add(Math.round(sign*(whole-1+frac)*1000)/1000);
      out.add(Math.round(sign*(whole+1+frac)*1000)/1000);
      out.delete(0);
    }
  }
  return [...out].sort((a,b)=>Math.abs(a-v)-Math.abs(b-v)).slice(0,4);
}




function tipNorm(s){
  // Drop apostrophes so "Gunner's" → "gunners" (not "gunner s") — a lone "s"
  // token was matching OCR garbage like "T= T= (we r==S (S".
  return String(s||"").toLowerCase().replace(/[''′]/g,"")
    .replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
}
function tipLev(a,b){
  a=tipNorm(a); b=tipNorm(b);
  if(a===b) return 0;
  const m=a.length, n=b.length;
  if(!m) return n; if(!n) return m;
  const row=new Array(n+1);
  for(let j=0;j<=n;j++) row[j]=j;
  for(let i=1;i<=m;i++){
    let prev=row[0]; row[0]=i;
    for(let j=1;j<=n;j++){
      const cur=row[j];
      row[j]=a[i-1]===b[j-1]?prev:1+Math.min(prev,row[j],row[j-1]);
      prev=cur;
    }
  }
  return row[n];
}
function fixOcrNumberToken(tok){
  // Only rewrite lookalikes inside a numeric token — never touch stat names.
  return tok.replace(/[Il|]/g,"1").replace(/[Oo@]/g,"0").replace(/[Ss]/g,"5")
             .replace(/[Bb]/g,"8").replace(/[Zz]/g,"2").replace(/,/g,"");
}
function normalizeSlotTip(raw){
  const t=tipNorm(raw);
  if(!t) return null;
  if(SLOT_ALIAS[raw]) return SLOT_ALIAS[raw];
  for(const [k,v] of Object.entries(SLOT_FROM_TIP)){
    if(t===k || t.includes(k)) return v;
  }
  if(SLOTS.includes(raw)) return raw;
  return null;
}
function looksLikeItemNameLine(line){
  const q=tipNorm(line);
  if(q.length<5) return false;
  if(/^(primary|secondary|sacondary|frimary|prirnary|requires|press|found|forged)/i.test(q)) return false;
  const letters=((String(line).match(/[A-Za-z]/g))||[]).length;
  return letters>=Math.max(4, Math.ceil(String(line).length*0.45));
}


let _libPool=null;
function libPool(){
  if(_libPool) return _libPool;
  const seen=new Set(GEAR_LIB.map(g=>tipNorm(g.name)));
  /* A display name can cover several tiers - there is a Lunar Conduit Robe at
     Tier 5 and another at Tier 6, with different stats and different legendary
     effects - so a plain name lookup silently picks whichever tier came last.
     Item level is the sum of the primaries, which identifies the tier, so match
     on name AND level and refuse when nothing lands close. */
  const byName={};
  for(const id in ITEM_NAMES){
    const k=tipNorm(ITEM_NAMES[id]);
    (byName[k]=byName[k]||[]).push(id);
  }
  const dbFor=(name,lvl)=>{
    const ids=byName[tipNorm(name)]; if(!ids||!ids.length) return null;
    let best=null, bestD=Infinity;
    for(const id of ids){
      const d=Math.abs((+ITEM_DB[id].lvl||0)-(+lvl||0));
      if(d<bestD){ bestD=d; best=ITEM_DB[id]; }
    }
    return bestD<=1 ? best : null;
  };
  const out=GEAR_LIB.map(g=>{
    const it=dbFor(g.name, g.lvl);
    if(!it) return g;
    const g2=Object.assign({}, g);
    if(it.pk) g2.pk=it.pk;
    // Add base secondaries the tooltip transcription did not list, never
    // overwriting a stat it did - the observed value describes a real copy.
    const have=new Set((g.rolls||[]).map(r=>r.s));
    const extra=Object.keys(it.bs||{}).filter(s=>!have.has(s));
    if(extra.length) g2.rolls=(g.rolls||[]).concat(extra.map(s=>({s,p:0,v:+it.bs[s]})));
    return g2;
  });
  for(const id in ITEM_DB){
    const it=ITEM_DB[id];
    const name=(typeof ITEM_NAMES!=="undefined" && ITEM_NAMES[id])||"";
    if(!name || seen.has(tipNorm(name))) continue;
    const m=/^(armor|weapon|accessory)_t\d+_([a-z]+)/.exec(id);
    if(!m) continue;
    const slot=m[1]==="weapon" ? "Arms" : ID_SLOT[m[2]];
    if(!slot) continue;
    const rolls=Object.keys(it.p||{}).map(s=>({s,p:1,v:+it.p[s]}));
    // base secondaries are fixed, not rolled - same shape the library already
    // uses for lines like the Neotilus boots' extra projectile
    for(const s in (it.bs||{})) rolls.push({s,p:0,v:+it.bs[s]});
    const top=(it.r||[]).length?Math.max.apply(null,it.r):null;
    const known=it.fx?procFor(it.fx.a,id):null;
    out.push({
      slot, name, lvl:it.lvl, rolledSec:0, pk:it.pk||null,
      rarity: top!=null ? (RARITY_NAME[top]||"") : "",
      fx: it.fx ? {trigger:String(it.fx.t||"").replace(/_/g," "),
                   scope:it.fx.s||"",
                   effect:(known&&known.effect)||String(it.fx.a||"").replace(/_/g," ")} : null,
      rolls, _id:id, _fromDb:true,
    });
    seen.add(tipNorm(name));
  }
  _libPool=out;
  return out;
}


function flavourTokens(s){
  return (String(s||"").toLowerCase().match(/[a-z]{4,}/g)||[]).filter(t=>!FLAVOUR_STOP.has(t));
}
let _flavourIndex=null;
function flavourIndex(){
  if(_flavourIndex) return _flavourIndex;
  _flavourIndex=Object.keys(FLAVOUR).map(id=>({id, toks:flavourTokens(FLAVOUR[id])}))
                      .filter(e=>e.toks.length>=3);
  return _flavourIndex;
}
function flavourMatch(rawText){
  const hay=new Set(flavourTokens(rawText));
  if(hay.size<3) return null;
  let best=null, bestScore=0, second=0;
  for(const e of flavourIndex()){
    let hit=0;
    for(const t of e.toks) if(hay.has(t)) hit++;
    const score=hit/e.toks.length;
    if(score>bestScore){ second=bestScore; bestScore=score; best=e; }
    else if(score>second){ second=score; }
  }
  // Needs to be a strong match AND clearly ahead of the runner-up, or the shared
  // belt and weapon wordings would resolve to whichever came first.
  if(!best || bestScore<0.55 || bestScore-second<0.2) return null;
  const name=(typeof ITEM_NAMES!=="undefined" && ITEM_NAMES[best.id])||"";
  if(!name) return null;
  return libPool().find(g=>tipNorm(g.name)===tipNorm(name))||null;
}

function fuzzyLibMatch(name){
  const q=tipNorm(name); if(!q || q.length<4) return null;
  // Pixel font often splits words: "Lh nar To duit Robe" → lunar conduit robe.
  const qRepaired=q
    .replace(/\blh\s*nar\b/g,"lunar")
    .replace(/\bto\s*duit\b/g,"conduit")
    .replace(/\bduit\b/g,"conduit");
  let best=null, bestScore=Infinity;
  for(const g of libPool()){
    const n=tipNorm(g.name);
    const scoreFor=qq=>{
      let score=tipLev(n,qq);
      if(qq.length>=5 && (n.includes(qq) || qq.includes(n)))
        score=Math.min(score, Math.abs(n.length-qq.length)*0.25);
      const nt=new Set(n.split(" ").filter(t=>t.length>=3));
      const qt=qq.split(" ").filter(t=>t.length>=3);
      let hit=qt.filter(t=>nt.has(t)).length;
      // Soft hits: "duit"⊂"conduit", "nar"≈"lunar"
      let softCost=0;
      if(hit<2){
        const used=new Set([...nt].filter(t=>qt.includes(t)));
        for(const t of qt){
          if([...nt].some(x=>x===t)) continue;
          for(const ntok of nt){
            if(used.has(ntok)) continue;
            if(Math.min(t.length,ntok.length)<3) continue;
            const dist=tipLev(t,ntok);
            if(ntok.includes(t) || t.includes(ntok) || dist<=Math.ceil(ntok.length*0.34)){
              hit++; used.add(ntok);
              // A soft hit must never score as well as an exact one. Without this
              // the whole "-line Belt" family collapses onto whichever member the
              // loop reaches first: "stormline belt" soft-matches "frostline belt"
              // at zero cost, so Stormline Belt could never match itself.
              softCost+=(ntok.includes(t)||t.includes(ntok)) ? 0.5 : Math.max(0.5, dist);
              break;
            }
          }
        }
      }
      if(hit>=2) score=Math.min(score, (nt.size-hit)+Math.max(0,qt.length-hit)*0.5+softCost);
      return score;
    };
    const score=Math.min(scoreFor(q), scoreFor(qRepaired));
    if(score<bestScore){ bestScore=score; best=g; }
  }
  if(!best) return null;
  const lim=Math.max(2, Math.ceil(tipNorm(best.name).length*0.22));
  return bestScore<=lim ? best : null;
}
/* When the title is garbage but primaries survived, match a library item whose
   fixed primary values line up (Midnight Kimono 48/12/12 vs OCR 48 Vit + 12 Prec). */
function libMatchByPrimaries(rolls, lvl){
  const ocrP=(rolls||[]).filter(r=>r.p && AKEYS.includes(r.s));
  if(ocrP.length<2) return null;
  let best=null, bestHits=0, bestShape=0, ambiguous=false;
  for(const g of libPool()){
    const ps=(g.rolls||[]).filter(r=>r.p);
    if(ps.length<2) continue;
    if(lvl!=null && g.lvl!=null && Math.abs(+g.lvl-+lvl)>8) continue;
    let hits=0;
    for(const p of ps){
      if(ocrP.some(r=>r.s===p.s && Math.abs((+r.v)-(+p.v))<=1)) hits++;
    }
    if(hits<2) continue;
    // Tie-break exact values by primary stat identity. Example at level 64:
    // OCR 48 Vit / 12 Will / 12 Focus gives two exact hits for both Midnight
    // Kimono and Dark Obsidian Legs, but only the Legs share all three stats
    // (the pixel-font 0 in its 40 Vitality was read as 8).
    const shape=ps.filter(p=>ocrP.some(r=>r.s===p.s)).length;
    if(hits>bestHits || (hits===bestHits && shape>bestShape)){
      bestHits=hits; bestShape=shape; best=g; ambiguous=false;
    }else if(hits===bestHits && shape===bestShape){
      ambiguous=true;
    }
  }
  return (!ambiguous && bestHits>=2) ? best : null;
}
function pickRingSlot(){
  if(!S.gear["Ring 1"]) return "Ring 1";
  if(!S.gear["Ring 2"]) return "Ring 2";
  return "Ring 1";
}
function resolveImportSlot(slot, lib){
  const raw=lib?lib.slot:(slot||null);
  if(!raw) return null;
  if(raw==="Ring 1" || raw==="Ring 2") return pickRingSlot();
  return raw;
}

// "+8.80% Attack Speed", "[Gun] +24% Attack Speed", "29 vit", "+13 Power"
function parseRollLine(line){
  let s=String(line||"").trim(); if(!s) return null;
  // OCR often splits "+ 15 Power" or reads "+l5"
  s=s.replace(/^([+\-])\s+/,"$1");
  let tag=null;
  const tm=s.match(/^\[([A-Za-z ]+)\]\s*/);
  if(tm){
    const key=tm[1].toLowerCase().replace(/\s+/g,"");
    const found=TAG_KEYS.find(k=>k===key || TAG_NAME[k].toLowerCase().replace(/\s+/g,"")===key);
    if(found) tag=found;
    s=s.slice(tm[0].length);
  }
  // Leading OCR junk before the roll: "1] +224 Healing", "men +27 Duration", `"132 Focus`.
  // Prefer the rightmost "+<digit> …stat" when junk precedes it (the "1]" prefix).
  const tailPlus=s.match(/^(.*?)([+\-]\d[\dIl|O0-9SsBbZz.@]*(?:\s*[%:])?\s+[A-Za-z].*)$/i);
  if(tailPlus && tailPlus[1].length>0) s=tailPlus[2];
  else s=s.replace(/^[^+\-\d]*?(?=[+\-]?\d)/,"");
  // "+2 S68 Cooldown" — decimal / % fragment split into a second token.
  // Only join when the middle token is digits-after-OCR (S68→568). Never glue
  // real words: "+25 Oot Potency" must not become "+2500t Potency".
  s=s.replace(/^([+\-]?)(\d+)\s+([A-Za-z0-9Il|OSsBbZz@]{2,4})\s+(?=[A-Za-z])/,(_,sign,a,b)=>{
    // "5A" / "50" — trailing letter noise on a % hundredths fragment.
    if(/^5[AOoa@0]$/.test(b)) return `${sign||""}${a}.50 `;
    if(/^8[AOoa@0]$/.test(b)) return `${sign||""}${a}.80 `;
    const frac=fixOcrNumberToken(b);
    if(!/^\d+$/.test(frac) || frac.length<2) return `${sign||""}${a} ${b} `;
    // Three-glyph OCR of ".50"/".80" (S68, 568, 508, 808…) → collapse to two digits.
    let out=frac;
    if(frac.length===3){
      if(/^5[068][08]$/.test(frac)) out="50";
      else if(/^8[068][08]$/.test(frac)) out="80";
    }
    return `${sign||""}${a}.${out} `;
  });
  // "F260 58% Dot Potency" — letter glued on the number, then split digit groups.
  s=s.replace(/^[A-Za-z](?=\d)/,"");
  s=s.replace(/^([+\-]?)(\d+(?:\s+\d+)+)\s*(%)(?=\s)/,(_,sign,nums,pct)=>(sign||"")+nums.replace(/\s+/g,"")+pct);
  // Pixel "%" often reads as ":" — "+280: Attack Speed".
  s=s.replace(/([0-9])\s*[:;]\s+/g,"$1% ");

  // number may lead ("+29 Vitality") or trail ("Vitality 29")
  let m=s.match(/^([+\-]?)([Il|O0-9SsBbZz.@]+)\s*([%:]?)\s*(.+)$/);
  if(m){
    const num=fixOcrNumberToken(m[2]);
    if(/^\d+(?:\.\d+)?$/.test(num)) m=[null, (m[1]||"")+num, m[3]===":"?"%":m[3], m[4]];
    else m=null;
  }
  if(!m) m=(()=>{ const t=s.match(/^(.+?)\s+([+\-]?)([Il|O0-9SsBbZz.@]+)\s*([%:]?)$/);
                  if(!t) return null;
                  const num=fixOcrNumberToken(t[3]);
                  if(!/^\d+(?:\.\d+)?$/.test(num)) return null;
                  return [null, (t[2]||"")+num, t[4]===":"?"%":t[4], t[1]]; })();
  if(!m) return null;
  let value=parseFloat(m[1]); if(isNaN(value)) return null;
  const hadPct=m[2]==="%";
  let name=m[3].toLowerCase().replace(/[^a-z% ]/g,"").replace(/\s+/g," ").trim()
              .replace(/\s*%$/,"").replace(/^\++|\++$/g,"").trim();
  let stat=STAT_ALIASES[name];
  if(!stat){
    // Fuzzy-ish: strip trailing junk OCR attaches ("Power." / "Vitalityy" / "Qritical")
    const keys=Object.keys(STAT_ALIASES).sort((a,b)=>b.length-a.length);
    const hit=keys.find(k=>{
      if(name===k || name.startsWith(k+" ")) return true;
      if(k.length<4) return false;
      const lim=k.length>=12?2:1;
      return tipLev(name,k)<=lim;
    });
    if(hit) stat=STAT_ALIASES[hit];
  }
  if(!stat) return null;
  // Prefer the % twin when the pasted line had a % and the flat key has no % label
  // (e.g. "-100% Link Count" → link_count_pct). Skip keys we already treat as
  // tooltip-% (Dot Potency / AoE) — those stay on the flat key the planner uses.
  if(hadPct && SEC[stat] && !/%/.test(SEC[stat]) && SEC[stat+"_pct"] && !isPctStat(stat))
    stat=stat+"_pct";
  const isAttr=AKEYS.includes(stat);
  // Attribute OCR often glues a trailing junk digit (+13 → +132).
  if(isAttr && !hadPct && Number.isInteger(value) && value>=100 && String(Math.abs(value)).length===3)
    value=parseFloat(String(Math.abs(value)).slice(0,-1))*Math.sign(value||1);
  const roll={s:stat,p:isAttr?1:0,v:value,hadPct:!!hadPct};
  // "+2 Focus +" when the real roll is +12 — leading digit dropped. Flag tiny
  // primaries so we don't silently import a wrong 2.
  if(isAttr && !hadPct && Number.isInteger(value) && value>0 && value<8){
    roll.flagged=true; roll.ocrV=value;
    roll.note="primary looks truncated — check the real value";
  }
  if(!isAttr && tag) roll.t=tag;
  return roll;
}

/* When the number is garbage (+E Vitality, + Lil] Will) but the stat name is
   still recognizable, recover a roll so slot inference / secondaries aren't lost. */
function recoverMangledRoll(line){
  const raw=String(line||"").trim(); if(!raw || raw.length<3) return null;
  if(parseRollLine(raw)) return null; // caller should try parse first
  const low=tipNorm(raw);
  const keys=Object.keys(STAT_ALIASES).filter(k=>k.length>=3).sort((a,b)=>b.length-a.length);
  let stat=null, keyHit=null;
  const tryKey=k=>{
    if(stat) return;
    if(low===k || low.endsWith(" "+k) || low.includes(k)){ stat=STAT_ALIASES[k]; keyHit=k; return; }
    if(k.length>=4 && tipLev(low,k)<=Math.min(2, Math.ceil(k.length*0.3))){ stat=STAT_ALIASES[k]; keyHit=k; }
  };
  for(const k of keys) tryKey(k);
  // "+E Yitality" — leading junk token; match individual words against aliases.
  if(!stat){
    for(const tok of low.split(" ").filter(t=>t.length>=4)){
      for(const k of keys){
        if(tok===k || tipLev(tok,k)<=Math.min(1, Math.ceil(k.length*0.25))){
          stat=STAT_ALIASES[k]; keyHit=k; break;
        }
      }
      if(stat) break;
    }
  }
  if(!stat) return null;
  // Prefer a real number token if any; otherwise flag for manual fill.
  // Only accept a leading roll number — never a letter inside the stat name
  // ("Yitality" must not yield "1" from the "l").
  let value=NaN, hadPct=/%/.test(raw);
  const nm=raw.match(/^[+\-]?\s*([0-9Il|OSsBbZz.@]{1,6})(?=\s|[%:]|$)/);
  if(nm){
    const num=fixOcrNumberToken(nm[1]);
    if(/^\d+(?:\.\d+)?$/.test(num)) value=parseFloat(num);
  }
  const isAttr=AKEYS.includes(stat);
  const roll={s:stat, p:isAttr?1:0, v:isNaN(value)?0:value, hadPct:!!hadPct};
  if(isNaN(value)){ roll.flagged=true; roll.ocrV=raw; roll.note="couldn't read a number — fill after equipping"; }
  return roll;
}

function parseTooltipText(text){
  const raw=String(text||"").replace(/\r/g,"");
  let lines=raw.split(/\n/).map(l=>l.replace(/\s+/g," ").trim()).filter(Boolean);
  // Tooltips wrap "+1 additional / projectile" (and "+1 additional Pyrosphere /
  // projectile") across two lines.
  const stitched=[];
  for(let i=0;i<lines.length;i++){
    const a=lines[i], b=lines[i+1];
    if(b && /additional(?:\s+\w+)?$/i.test(a) && /^projectiles?$/i.test(b)){
      stitched.push(a+" "+b); i++; continue;
    }
    if(b && /abilities have/i.test(a) && /projectile/i.test(b) && !/projectile/i.test(a)){
      stitched.push(a+" "+b); i++; continue;
    }
    stitched.push(a);
  }
  lines=stitched;
  const skip=/^(primary|secondary|requires:?|press shift|compare|forged|found in|foundation-pattern|volatile)/i;
  let name=null, slot=null, rarity=null, lvl=null, section=null;
  const rolls=[], fxLines=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i], low=line.toLowerCase();
    if(/^primary\b/i.test(line) || /^[^a-z]*primary[^a-z]*$/i.test(line)
       || (/frimary|prirnary|pr[iı]mary|prnary/i.test(line) && line.length<=18)){ section="primary"; continue; }
    if((/secondary|sacondary|secon+dary/i.test(line) && line.length<=20)){ section="secondary"; continue; }
    if(/^requires/i.test(line) || /requires\s*:/i.test(line)){ section="req"; continue; }
    if(/press\s*shift|to\s*compare/i.test(line)){ section="foot"; continue; }
    if(section==="req" || section==="foot") continue;

    // Pixel digits in the level line: "Level b4" / "Level B4" → Level 64.
    // Normalize only the number token so letters in item names remain untouched.
    const lm=line.match(/^level\s*[:.]?\s*([0-9BbOoSsIl|]{1,3})\b/i)
          || line.match(/\blevel\s*[:.]?\s*([0-9BbOoSsIl|]{1,3})\b/i);
    if(lm){
      const levelNum=+fixOcrNumberToken(lm[1].replace(/[bB]/g,"6"));
      if(levelNum>0 && levelNum<200){ lvl=levelNum; continue; }
    }

    // "abilities have +1 additional projectile" — unique fixed line, not a dropdown secondary.
    // "abilities have +1 additional projectile" / "+1 additional Pyrosphere projectile"
    const proj=line.match(/abilities have\s*\+?(\d+)\s+additional\s+projectiles?/i)
             || line.match(/\+?(\d+)\s+additional\s+projectiles?/i)
             || line.match(/\+?(\d+)\s+additional\s+([A-Za-z]+)\s+projectiles?/i);
    if(proj && (section==="secondary" || section==="primary" || !section)){
      const roll={s:"projectile_count",p:0,v:+proj[1]};
      const scope=(proj[2]||"").toLowerCase();
      if(scope){
        const tag=TAG_KEYS.find(k=>{
          if(k===scope) return true;
          const label=(TAG_NAME[k]||k).toLowerCase().replace(/\s+/g,"");
          return tipLev(label, scope)<=1 || tipLev(k, scope)<=1;
        });
        if(tag) roll.t=tag;
      }
      rolls.push(roll);
      continue;
    }

    const rarityHit=(()=>{
      const low=tipNorm(line);
      const rares=["legendary","epic","rare","uncommon","common"];
      for(const r of rares){
        if(low.startsWith(r+" ") || low===r) return {rarity:r, rest:low.slice(r.length).trim()};
        // OCR often mangles the start ("{32andary Feet") — accept a token that is
        // a long substring of the rarity word, then take the trailing slot word.
        for(const tok of low.split(" ")){
          if(tok.length>=4 && (r.includes(tok) || tipLev(tok,r)<=Math.ceil(r.length*0.34))){
            const rest=low.slice(low.indexOf(tok)+tok.length).trim();
            return {rarity:r, rest};
          }
        }
      }
      return null;
    })();
    if(rarityHit && rarityHit.rest){
      rarity=rarityHit.rarity;
      slot=normalizeSlotTip(rarityHit.rest.replace(/=+$/,"").trim()) || slot;
      if(!name){
        for(let j=i-1;j>=0;j--){
          if(skip.test(lines[j]) || RARITY_RE.test(lines[j]) || /^level\b/i.test(lines[j])) continue;
          if(parseRollLine(lines[j])) continue;
          name=lines[j].replace(/^[^A-Za-z]+/,"").replace(/[^A-Za-z0-9' -]+$/g,"").trim(); break;
        }
      }
      continue;
    }

    if(section==="primary" || section==="secondary"){
      const r=parseRollLine(line) || recoverMangledRoll(line);
      if(r){
        // Trust section headers over attr/secondary classification — but never
        // mark a non-attribute as primary just because it sat under Primary.
        if(section==="primary") r.p=AKEYS.includes(r.s)?1:0;
        else r.p=0;
        rolls.push(r);
        continue;
      }
      // Unique effect lines sit under Secondary and aren't parseable rolls.
      if(section==="secondary" && !/^\d+%?\s*$/.test(line) && line.length>12){
        fxLines.push(line);
      }
      continue;
    }

    // Before sections: try rolls anyway (OCR sometimes drops "Primary"/"Secondary")
    if(!section){
      const r=parseRollLine(line);
      if(r){ rolls.push(r); continue; }
      if(!name && !RARITY_RE.test(line) && !/^level\b/i.test(line) && !skip.test(line) && /[A-Za-z]/.test(line)){
        // Prefer the longest early title-ish line as a candidate; first wins unless
        // a later line looks more like a full item name (3+ words).
        const cand=line.replace(/^[^A-Za-z]+/,"").replace(/[^A-Za-z0-9' -]+$/g,"").trim();
        if(!name) name=cand;
        else if(cand.split(/\s+/).length>=3 && name.split(/\s+/).length<3) name=cand;
      }
    }
  }

  // If OCR never saw Primary/Secondary, classify by attr vs secondary.
  if(!lines.some(l=>/^primary$/i.test(l)||/^secondary$/i.test(l))){
    rolls.forEach(r=>{ r.p=AKEYS.includes(r.s)?1:0; });
  }

  if(name) name=name.replace(/[^A-Za-z0-9' -]+$/g,"").trim()
    // Common pixel-font miss on Voidline (V → YW / W).
    .replace(/\bY?Woidline\b/i,"Voidline");

  const lib=fuzzyLibMatch(name) || (()=>{
    // Fall back: score every line as a possible name against the library.
    let best=null, bestScore=Infinity, bestName=null;
    for(const line of lines){
      if(skip.test(line) || RARITY_RE.test(line) || /^level\b/i.test(line)) continue;
      if(!looksLikeItemNameLine(line)) continue;
      if(parseRollLine(line)) continue;
      const g=fuzzyLibMatch(line);
      if(!g) continue;
      const sc=tipLev(g.name, line);
      if(sc<bestScore){ bestScore=sc; best=g; bestName=line; }
    }
    if(best && !name) name=bestName;
    return best;
  })() || (()=>{
    // Distinctive tagged projectile lines often identify the ring when the title
    // was lost to background UI ("ABILITIES" bleeding into the crop).
    const tagged=rolls.find(r=>r.s==="projectile_count" && r.t);
    if(!tagged) return null;
    const g=libPool().find(x=>(x.rolls||[]).some(r=>r.s==="projectile_count" && r.t===tagged.t));
    return g||null;
  })() || libMatchByPrimaries(rolls, lvl) || flavourMatch(raw);

  // Refuse accessory/library matches when OCR clearly shows armour primaries
  // (Vitality + offensive) — stops junk lines falsely matching Gunner's Pendant.
  const ocrPrimaries=rolls.filter(r=>r.p && AKEYS.includes(r.s));
  const libPrimaries=lib?(lib.rolls||[]).filter(r=>r.p):[];
  let libOut=lib;
  if(libOut && ocrPrimaries.length>=2 && libPrimaries.length===0) libOut=null;
  if(libOut && ocrPrimaries.some(r=>r.s==="vitality") && !libPrimaries.some(r=>r.s==="vitality"))
    libOut=null;

  if(libOut){
    name=libOut.name;
    if(!slot) slot=libOut.slot;
  }
  // Name alone often encodes the slot when OCR ate "Epic Neck" / "Legendary Feet".
  if(!slot && name) slot=normalizeSlotTip(name);
  // Rarity line lost "Epic" but kept "Torso"/"Feet", or title ends with Chest.
  if(!slot){
    for(const line of lines){
      if(skip.test(line) || /^level\b/i.test(line) || parseRollLine(line)) continue;
      const s=normalizeSlotTip(line);
      if(s){ slot=s; break; }
    }
  }
  // Armour: any primary attrs (even with mangled values) → default Chest when the
  // rarity line didn't name Head/Feet. User can override in the preview.
  if(!slot){
    const attrs=rolls.filter(r=>r.p && AKEYS.includes(r.s));
    if(attrs.some(r=>r.s==="vitality") || attrs.length>=2) slot="Chest";
    else if(attrs.length===1 && ["will","focus","power","ferocity","precision"].includes(attrs[0].s))
      slot="Chest";
  }

  return {
    name:name||"",
    slot,
    rarity,
    lvl,
    rolls,
    fx:fxLines.join(" "),
    lib:libOut,
    raw,
  };
}

function annotateOcrRoll(r){
  if(r.flagged && (r.note||r.ocrV!=null)){
    const o={s:r.s, p:r.p?1:0, v:0, src:"ocr", flagged:true, ocrV:r.ocrV||r.v, note:r.note||"couldn't read a number"};
    if(r.t) o.t=r.t;
    return o;
  }
  const san=sanitizeOcrValue(r.s, r.v, r.hadPct);
  const o={s:r.s, p:r.p?1:0, v:san.flagged?0:san.v, src:"ocr"};
  if(r.t) o.t=r.t;
  if(san.flagged){ o.flagged=true; o.ocrV=r.v; o.note=san.note; }
  else if(san.fixed){ o.fixed=true; o.ocrV=san.was; o.note=san.note; }
  if(!o.flagged){
    const alternatives=plausibleOcrAlternatives(r.s,o.v);
    if(alternatives.length){
      o.alternatives=alternatives;
      o.uncertain=true;
    }
  }
  return o;
}
function buildImportGear(parsed){
  const slot=resolveImportSlot(parsed.slot, parsed.lib);
  if(!slot) return null;
  if(parsed.lib){
    // Pass OCR rarity so epic rings don't get the legendary rolledSec count.
    const m=materializeLibItem(parsed.lib, parsed.rarity);
    // Tag library-fixed rolls so the preview can tell them apart from OCR.
    m.rolls=m.rolls.map(r=>{
      if(!r.s) return {s:"",p:0,v:0,src:"ocr"}; // empty pick slot, filled below
      const o={s:r.s,p:r.p?1:0,v:+r.v||0,src:"lib"}; if(r.t) o.t=r.t; return o;
    });
    const fixed=(parsed.lib.rolls||[]).map(r=>r.s);
    const fixedSet=new Set(fixed);
    // Random secondaries only — ignore OCR primaries when the library knows them.
    // Also skip the fixed unique line if OCR re-read it (e.g. +1 Pyrosphere projectile).
    const secs=parsed.rolls.filter(r=>!r.p && r.s && !fixedSet.has(r.s)).map(annotateOcrRoll);
    let pi=0;
    for(let i=0;i<m.rolls.length;i++){
      if(!m.rolls[i].s && pi<secs.length){
        m.rolls[i]=secs[pi++];
      }
    }
    while(pi<secs.length) m.rolls.push(secs[pi++]);
    // Tooltip is authoritative — drop leftover empty picks from the legendary
    // template when this drop rolled fewer (epic Pyrosphere = 2 random, not 3).
    m.rolls=m.rolls.filter(r=>r.s);
    return {slot, gear:m, fromLib:true};
  }
  const rolls=parsed.rolls.map(annotateOcrRoll);
  return {slot, gear:{item:parsed.name||"Imported item",lv:parsed.lvl||0,rolls}, fromLib:false};
}


function rollLabel(r){
  if(!r||!r.s) return "(empty pick)";
  const nm=r.p?(ATTRS[r.s]?ATTRS[r.s].name:r.s):(SEC[r.s]||r.s);
  const t=r.t||(r.p?null:IMPLIED_TAG[r.s])||null;
  const tag=t?`[${TAG_NAME[t]||t}] `:"";
  return `${tag}${r.v>=0?"+":""}${r.v} ${nm}`;
}
function shotRollLi(r,index){
  const nm=r.p?(ATTRS[r.s]?ATTRS[r.s].name:r.s):(SEC[r.s]||r.s||"roll");
  const tag=r.t?`[${TAG_NAME[r.t]||r.t}] `:"";
  if(r.flagged){
    return `<li class="bad" data-roll-index="${index}"><span class="k">check</span>+
      <input class="shot-value" type="number" step="any" data-roll-index="${index}"
        placeholder="${esc(String(r.ocrV||"?"))}" aria-label="Correct ${esc(nm)} value">
      ${esc(tag+nm)}
      <span class="note">${esc(r.note||"couldn't read this value")}. Enter the real number before equipping.</span></li>`;
  }
  const cls=r.src==="lib"?"db":(r.s?"ocr":"fix");
  const badge=r.src==="lib"?"db":(r.s?"ocr":"pick");
  if(r.src==="lib")
    return `<li class="${cls}" data-roll-index="${index}"><span class="k">${badge}</span>${esc(rollLabel(r))}</li>`;
  const possibilities=r.alternatives&&r.alternatives.length
    ? [r.v,...r.alternatives].map(String).join(" or ")
    : "";
  const note=possibilities
    ? `<span class="note">OCR uncertain — possible ${esc(possibilities)}. Confirm or edit this value.</span>`
    : (r.fixed?`<span class="note">${esc(r.note||"corrected from OCR")}</span>`:"");
  return `<li class="${cls}${r.uncertain?" uncertain":""}" data-roll-index="${index}">
    <span class="k">${r.uncertain?"check":badge}</span>+
    <input class="shot-value" type="number" step="any" value="${esc(String(r.v))}"
      data-roll-index="${index}" aria-label="Edit ${esc(nm)} value">
    ${esc(tag+nm)}${note}</li>`;
}

function refreshShotWarnings(){
  if(!_shotPending) return;
  const rolls=_shotPending.built.gear.rolls||[];
  const flagged=rolls.filter(r=>r.flagged).length;
  const uncertain=rolls.filter(r=>r.uncertain).length;
  const el=document.getElementById("shotWarn");
  if(!el) return;
  const parts=[];
  if(flagged) parts.push(`${flagged} unread value${flagged>1?"s":""} must be filled`);
  if(uncertain) parts.push(`${uncertain} ambiguous value${uncertain>1?"s":""} should be confirmed`);
  el.hidden=!parts.length;
  el.textContent=parts.length?parts.join("; ")+". Edit the fields above before equipping.":"";
}

function wireShotValueInputs(){
  document.querySelectorAll(".shot-value").forEach(input=>{
    input.oninput=()=>{
      if(!_shotPending) return;
      const index=+input.dataset.rollIndex;
      const r=(_shotPending.built.gear.rolls||[])[index];
      if(!r) return;
      const n=parseFloat(input.value);
      const li=input.closest("li");
      if(isFinite(n)){
        r.v=n; r.flagged=false; r.userEdited=true;
        delete r.uncertain; delete r.alternatives; delete r.fixed;
        delete r.note; delete r.ocrV;
        if(li){ li.classList.remove("bad","uncertain"); li.classList.add("ocr"); }
      }else{
        r.v=0; r.flagged=true;
        if(li){ li.classList.add("bad"); li.classList.remove("uncertain"); }
      }
      refreshShotWarnings();
    };
  });
}

let _shotPending=null;
let _tesseractReady=null;

function shotSetStatus(msg,isErr){
  const el=document.getElementById("shotStatus");
  if(!el) return;
  if(!msg){ el.hidden=true; el.textContent=""; return; }
  el.hidden=false;
  el.className="shot-status"+(isErr?" err":"");
  el.textContent=msg;
}
function shotClearPreview(){
  _shotPending=null;
  const box=document.getElementById("shotPreview");
  if(box){ box.hidden=true; box.innerHTML=""; }
}
function renderShotPreview(parsed, thumbUrl){
  let built=buildImportGear(parsed);
  const box=document.getElementById("shotPreview");
  if(!box) return;
  // Rolls present but no slot (mangled "Epic Torso" line) — still show a preview
  // with a slot picker instead of dead-ending.
  if(!built && (parsed.rolls||[]).length){
    const guess=parsed.slot||"Chest";
    built=buildImportGear({...parsed, slot:guess});
    if(built) built.needsSlotPick=true;
  }
  if(!built){
    box.hidden=false;
    box.innerHTML=`<div class="shot-meta">Couldn't read enough from that tooltip. Try a tighter crop of just the tooltip, or paste the lines into a slot.</div>
      <div class="shot-actions"><button type="button" class="addbtn" id="shotCancel">Dismiss</button></div>`;
    document.getElementById("shotCancel").onclick=()=>{ shotClearPreview(); shotSetStatus(""); };
    return;
  }
  _shotPending={parsed, built, thumbUrl};
  const g=built.gear;
  const rolls=g.rolls||[];
  const flagged=rolls.filter(r=>r.flagged).length;
  const uncertain=rolls.filter(r=>r.uncertain).length;
  const src=built.fromLib
    ? `Matched library item — amber rows are from the database, cyan rows from the screenshot.`
    : `Not in the item database — every number is from OCR (double-check them).`;
  const slotOpts=SLOTS.map(sl=>`<option value="${esc(sl)}"${sl===built.slot?" selected":""}>${esc(sl)}</option>`).join("");
  box.hidden=false;
  box.innerHTML=`<div class="shot-prev">
      ${thumbUrl?`<img src="${thumbUrl}" alt="Tooltip screenshot preview">`:""}
      <div class="shot-meta">
        <div><b>${esc(g.item||parsed.name||"Item")}</b>
          <label class="slotpill" style="display:inline-flex;align-items:center;gap:4px;cursor:pointer">
            <select id="shotSlot" style="background:transparent;border:0;color:inherit;font:inherit;cursor:pointer">${slotOpts}</select>
          </label>
        </div>
        <div style="margin-top:4px;color:var(--faint);font-size:12px">${esc(src)}${built.needsSlotPick?" Pick the slot if Chest is wrong.":""}</div>
        <ul class="shot-rolls">${rolls.map(shotRollLi).join("")}</ul>
        <div class="shot-warn" id="shotWarn"${flagged||uncertain?"":" hidden"}></div>
        <div class="shot-actions">
          <button type="button" class="btn primary" id="shotEquip">Equip</button>
          <button type="button" class="addbtn" id="shotCancel">Cancel</button>
        </div>
      </div>
    </div>`;
  const slotEl=document.getElementById("shotSlot");
  if(slotEl) slotEl.onchange=()=>{
    if(!_shotPending) return;
    _shotPending.built.slot=slotEl.value;
    const btn=document.getElementById("shotEquip");
    if(btn) btn.textContent=`Equip to ${slotEl.value}`;
  };
  document.getElementById("shotEquip").onclick=()=>applyShotImport();
  document.getElementById("shotEquip").textContent=`Equip to ${built.slot}`;
  document.getElementById("shotCancel").onclick=()=>{ shotClearPreview(); shotSetStatus(""); };
  wireShotValueInputs();
  refreshShotWarnings();
}
function applyShotImport(){
  if(!_shotPending) return;
  const {built}=_shotPending;
  // Persist only gameplay fields — drop OCR provenance. Flagged values stay as
  // empty picks (stat known, value 0) so the player fills the real number.
  const rolls=(built.gear.rolls||[]).map(r=>{
    const o={s:r.s||"", p:r.p?1:0, v:r.flagged?0:(+r.v||0)};
    if(r.t) o.t=r.t;
    return o;
  });
  const flagged=(built.gear.rolls||[]).filter(r=>r.flagged).length;
  S.gear[built.slot]={item:built.gear.item, lv:built.gear.lv||0, rolls};
  _openSlot=built.slot;
  shotClearPreview();
  shotSetStatus("");
  save();
  const empty=rolls.filter(r=>!r.p&&!r.s).length;
  if(flagged) toast(`Equipped ${built.gear.item} — fix ${flagged} flagged value${flagged>1?"s":""}`);
  else if(empty) toast(`Equipped ${built.gear.item} — fill ${empty} random secondary pick${empty>1?"s":""}`);
  else toast(`Equipped ${built.gear.item} in ${built.slot}`);
}

async function loadTesseract(){
  if(window.Tesseract) return window.Tesseract;
  if(_tesseractReady) return _tesseractReady;
  // Loaded from jsDelivr on demand — CSP on the live host allows that CDN plus
  // wasm-unsafe-eval / blob workers / tessdata (see .htaccess). Not vendored in
  // the repo; the ~20MB engine stays off git.
  _tesseractReady=new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.async=true;
    s.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error("Tesseract missing"));
    s.onerror=()=>reject(new Error("Couldn't load OCR library (network?)"));
    document.head.appendChild(s);
  });
  return _tesseractReady;
}
function loadImageFromBlob(blob){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(blob);
    const img=new Image();
    img.onload=()=>resolve({img,url});
    img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error("Couldn't read image")); };
    img.src=url;
  });
}

/* DoE-style preprocess: nearest-neighbour upscale (pixel font), auto polarity,
   Otsu bilevel so Tesseract sees crisp dark-on-light glyphs. forceInvert flips
   the polarity guess when the first read scores poorly. */
function prepTooltipImage(img, forceInvert){
  const scale=Math.min(8, Math.max(3, Math.ceil(1800/Math.max(img.width,1))));
  const c=document.createElement("canvas");
  c.width=Math.max(1, Math.round(img.width*scale));
  c.height=Math.max(1, Math.round(img.height*scale));
  const ctx=c.getContext("2d",{willReadFrequently:true});
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(img,0,0,c.width,c.height);
  const id=ctx.getImageData(0,0,c.width,c.height);
  const d=id.data;
  const n=d.length/4;
  const gray=new Uint8Array(n);
  let sum=0, k=0;
  for(let i=0;i<d.length;i+=4){
    const g=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    gray[k++]=g; sum+=g;
  }
  let darkBg=(sum/n)<128;
  if(forceInvert) darkBg=!darkBg;
  const hist=new Uint32Array(256);
  for(let i=0;i<n;i++){
    const gv=darkBg?255-gray[i]:gray[i];
    gray[i]=gv;
    hist[gv|0]++;
  }
  // Otsu threshold → pure black/white. Slight +bias keeps faint pixel strokes.
  let s2=0; for(let i=0;i<256;i++) s2+=i*hist[i];
  let sumB=0, wB=0, varMax=0, thr=127;
  for(let i=0;i<256;i++){
    wB+=hist[i]; if(!wB) continue;
    const wF=n-wB; if(!wF) break;
    sumB+=i*hist[i];
    const mB=sumB/wB, mF=(s2-sumB)/wF;
    const bt=wB*wF*(mB-mF)*(mB-mF);
    if(bt>varMax){ varMax=bt; thr=i; }
  }
  thr=Math.min(255, thr+8);
  k=0;
  for(let i=0;i<d.length;i+=4){
    const bv=gray[k++]<=thr?0:255;
    d[i]=d[i+1]=d[i+2]=bv; d[i+3]=255;
  }
  ctx.putImageData(id,0,0);
  return c;
}

/* Left strip of the tooltip — where "+40" / "+3.50%" sit — for a digit-focused
   second OCR pass when labels survived but numbers didn't. */
function cropDigitColumn(canvas){
  const w=Math.max(1, Math.round(canvas.width*0.42));
  const c=document.createElement("canvas");
  c.width=w; c.height=canvas.height;
  const ctx=c.getContext("2d");
  ctx.drawImage(canvas, 0, 0, w, canvas.height, 0, 0, w, c.height);
  return c;
}




function ocrScore(parsed){
  // Prefer more parsed rolls, then library matches — used to pick between OCR passes.
  let n=(parsed.rolls||[]).length*3;
  if(parsed.lib) n+=8;
  if(parsed.slot) n+=2;
  if(parsed.name && parsed.name.length>6 && !/^he?mel\b/i.test(parsed.name)) n+=1;
  if(parsed.name && parsed.name.length<=8 && !parsed.lib) n-=2;
  n+=(parsed.rolls||[]).filter(r=>!r.flagged && r.v).length;
  return n;
}

function needsDigitPass(parsed){
  const rolls=parsed.rolls||[];
  if(!rolls.length) return false;
  const primaries=rolls.filter(r=>r.p && AKEYS.includes(r.s));
  // Armour tooltips always show Vitality + 2 attrs — missing one means numbers failed.
  if(primaries.length>0 && primaries.length<3 && primaries.some(r=>r.s==="vitality"||r.flagged))
    return true;
  if(primaries.length>=1 && primaries.length<3 && rolls.some(r=>!r.p))
    return true;
  return rolls.some(r=>{
    if(r.flagged || !r.v) return true;
    if(AKEYS.includes(r.s) && Number.isInteger(+r.v) && +r.v>0 && +r.v<8) return true;
    // Whole-number % secondary that looks like a dropped decimal (3.50 → 2).
    if(isPctStat(r.s) && Number.isInteger(+r.v) && Math.abs(+r.v)<5) return true;
    return false;
  });
}

function extractDigitTokens(text){
  const out=[];
  for(const line of String(text||"").split(/\n/)){
    const s=line.trim(); if(!s) continue;
    // Require a leading "+"/"-" (tooltip rolls) or an explicit % — skip bare
    // numbers from Level / HUD bleed ("54", "eve] 54").
    const m=s.match(/^([+\-])\s*([Il|O0-9SsBbZz.@]+)\s*([%:]?)/)
          || s.match(/^([Il|O0-9SsBbZz.@]+)\s*([%:])/);
    if(!m) continue;
    let sign="", numTok, pct="";
    if(m[0][0]==="+"||m[0][0]==="-"){ sign=m[1]; numTok=m[2]; pct=m[3]||""; }
    else{ numTok=m[1]; pct=m[2]||""; }
    const num=fixOcrNumberToken(numTok);
    if(!/^\d+(?:\.\d+)?$/.test(num)) continue;
    const v=parseFloat(sign+num);
    if(isNaN(v)) continue;
    out.push({v, hadPct:pct==="%"||pct===":", raw:s});
  }
  return out;
}

/* Reattach digit-pass values onto rolls whose labels we already know but whose
   numbers were flagged / truncated. Order-preserving within Primary then Secondary. */
function refillRollsFromDigits(rolls, digitText){
  const tokens=extractDigitTokens(digitText);
  if(!tokens.length || !(rolls||[]).length) return;
  let ti=0;
  const weak=r=>r.flagged || !r.v || (AKEYS.includes(r.s) && Number.isInteger(+r.v) && +r.v>0 && +r.v<8);
  for(const r of rolls){
    if(ti>=tokens.length) break;
    if(!weak(r)) continue;
    const t=tokens[ti++];
    r.v=t.v;
    if(t.hadPct) r.hadPct=true;
    delete r.flagged;
    delete r.note;
    delete r.ocrV;
    // Re-apply truncated-primary guard only when still absurdly small.
    if(AKEYS.includes(r.s) && Number.isInteger(r.v) && r.v>0 && r.v<8){
      r.flagged=true; r.ocrV=r.v;
      r.note="primary looks truncated — check the real value";
    }
  }
}

function shotShowThumb(url){
  const box=document.getElementById("shotPreview");
  if(!box||!url) return;
  box.hidden=false;
  box.innerHTML=`<div class="shot-prev">
      <img src="${url}" alt="Tooltip screenshot preview">
      <div class="shot-meta">Reading on your device…</div>
    </div>`;
}

function ocrLogger(label){
  return m=>{
    if(m.status==="recognizing text" && m.progress!=null){
      shotSetStatus(`${label} · ${Math.round(m.progress*100)}%`);
    }else if(m.status==="loading language traineddata" && m.progress!=null){
      shotSetStatus(`Loading OCR language… ${Math.round(m.progress*100)}%`);
    }else if(m.status==="initializing tesseract"||m.status==="loading tesseract core"){
      shotSetStatus("Starting OCR…");
    }
  };
}

/* One worker: try each PSM on the same canvas, keep the best parse, then
   terminate (DoE lesson — reusing a worker across pastes can return empty). */
async function ocrBestOnCanvas(T, canvas, psms, whitelist, label){
  const worker=await T.createWorker("eng", 1, {logger:ocrLogger(label)});
  const texts=[];
  let bestParsed=null, bestText="", bestSc=-Infinity;
  try{
    for(const psm of psms){
      await worker.setParameters({
        tessedit_pageseg_mode:String(psm),
        tessedit_char_whitelist:whitelist,
      });
      const result=await worker.recognize(canvas);
      const text=(result&&result.data&&result.data.text)||"";
      if(!text.trim()) continue;
      texts.push(text);
      const parsed=parseTooltipText(text);
      const sc=ocrScore(parsed);
      if(sc>bestSc){ bestSc=sc; bestParsed=parsed; bestText=text; }
      if(bestSc>=14 && (bestParsed.rolls||[]).filter(r=>!r.flagged).length>=3) break;
    }
  }finally{
    try{ await worker.terminate(); }catch(e){}
  }
  return {parsed:bestParsed||parseTooltipText(""), text:bestText, texts, score:bestSc};
}

async function ocrTooltipImage(img){
  const T=await loadTesseract();
  // Primary path: Otsu prep once → PSM 3 then 6 (DoE pattern).
  shotSetStatus("Reading tooltip on your device…");
  let canvas=prepTooltipImage(img);
  let {parsed, texts, score}=await ocrBestOnCanvas(T, canvas, ["3","6"], OCR_WHITELIST, "Reading tooltip…");
  const rawParts=texts.slice();

  // Safety: polarity flip once if the first read is still weak.
  if(score<8){
    shotSetStatus("Reading tooltip… adjusting contrast…");
    canvas=prepTooltipImage(img, true);
    const retry=await ocrBestOnCanvas(T, canvas, ["6"], OCR_WHITELIST, "Reading tooltip…");
    rawParts.push(...retry.texts);
    if(retry.score>score){ parsed=retry.parsed; score=retry.score; }
  }

  // Digit column pass when labels landed but numbers look wrong / missing.
  if(needsDigitPass(parsed)){
    shotSetStatus("Reading tooltip… numbers…");
    const dig=cropDigitColumn(canvas);
    const worker=await T.createWorker("eng", 1, {logger:ocrLogger("Reading numbers…")});
    let digText="";
    try{
      await worker.setParameters({
        tessedit_pageseg_mode:"6",
        tessedit_char_whitelist:OCR_DIGIT_WHITELIST,
      });
      const result=await worker.recognize(dig);
      digText=(result&&result.data&&result.data.text)||"";
    }finally{
      try{ await worker.terminate(); }catch(e){}
    }
    if(digText.trim()){
      rawParts.push("--- digits ---\n"+digText);
      refillRollsFromDigits(parsed.rolls, digText);
    }
  }

  return {raw:rawParts.join("\n---\n"), parsed};
}

async function handleShotBlob(blob){
  if(!blob || !String(blob.type||"").startsWith("image/")){
    shotSetStatus("That isn't an image", true); return;
  }
  shotClearPreview();
  shotSetStatus("Loading OCR…");
  try{
    const {img,url}=await loadImageFromBlob(blob);
    // Show the paste immediately (DoE UX) while OCR runs on-device.
    shotShowThumb(url);
    shotSetStatus("Reading tooltip on your device…");
    const {raw, parsed}=await ocrTooltipImage(img);
    parsed.raw=raw||parsed.raw||"";
    if(!parsed.name && !parsed.rolls.length && !parsed.lib){
      shotSetStatus("Couldn't read that tooltip — try a tighter crop", true);
      renderShotPreview(parsed, url);
      return;
    }
    shotSetStatus(parsed.lib
      ? `Found ${parsed.lib.name}`
      : (parsed.name?`Read “${parsed.name}”`:"Read rolls from screenshot"));
    renderShotPreview(parsed, url);
  }catch(e){
    shotSetStatus(e.message||"OCR failed", true);
  }
}

async function pasteShotFromClipboard(){
  shotSetStatus("Reading clipboard…");
  try{
    if(navigator.clipboard && navigator.clipboard.read){
      const items=await navigator.clipboard.read();
      for(const item of items){
        const type=item.types.find(t=>t.startsWith("image/"));
        if(!type) continue;
        const blob=await item.getType(type);
        await handleShotBlob(blob);
        return;
      }
    }
    shotSetStatus("No image on the clipboard — copy a screenshot first (Win+Shift+S), then paste here", true);
  }catch(e){
    shotSetStatus("Clipboard blocked — focus this box and press Ctrl+V, or upload a file", true);
  }
}

function wireShotImport(){
  const zone=document.getElementById("shotZone");
  const pasteBtn=document.getElementById("shotPaste");
  const fileBtn=document.getElementById("shotFile");
  const input=document.getElementById("shotInput");
  if(!zone||!pasteBtn||!fileBtn||!input) return;

  pasteBtn.onclick=()=>pasteShotFromClipboard();
  fileBtn.onclick=()=>input.click();
  input.onchange=()=>{
    const f=input.files&&input.files[0];
    input.value="";
    if(f) handleShotBlob(f);
  };

  zone.addEventListener("dragover",e=>{ e.preventDefault(); zone.classList.add("drag"); });
  zone.addEventListener("dragleave",()=>zone.classList.remove("drag"));
  zone.addEventListener("drop",e=>{
    e.preventDefault(); zone.classList.remove("drag");
    const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
    if(f) handleShotBlob(f);
  });

  document.addEventListener("paste",e=>{
    const items=e.clipboardData&&e.clipboardData.items;
    if(!items) return;
    const img=[...items].find(i=>i.type&&i.type.startsWith("image/"));
    if(!img) return;
    // Don't steal pastes meant for text fields unless it's an image (text fields
    // can't accept image clipboard data anyway).
    e.preventDefault();
    handleShotBlob(img.getAsFile());
  });
}

function quickAdd(slot){
  const box=document.getElementById("qa_"+slot.replace(/\s/g,"_"));
  const text=(box?box.value:"")||"";
  const lines=text.split(/[\n;,]/).map(x=>x.trim()).filter(Boolean);
  const rolls=[],bad=[];
  lines.forEach(l=>{ const r=parseRollLine(l); if(r) rolls.push(r); else bad.push(l); });
  if(!rolls.length){ toast("Couldn't read any rolls — check the format"); return; }
  if(!S.gear[slot]) S.gear[slot]={item:"New item",rolls:[]};
  S.gear[slot].rolls=S.gear[slot].rolls.concat(rolls);
  save();
  toast(bad.length ? `Added ${rolls.length}, skipped ${bad.length}` : `Added ${rolls.length} rolls`);
}

function renderGear(){
  // Rebuilding innerHTML would collapse open slots — remember which were open
  // (and restore focus) so picking a secondary doesn't slam the panel shut.
  const open=new Set(), qaOpen=new Set();
  document.querySelectorAll("#gear details.slot[open]").forEach(d=>{
    const name=d.querySelector(".slotname")?.textContent;
    if(!name) return;
    open.add(name);
    if(d.querySelector("details.qa[open]")) qaOpen.add(name);
  });
  if(_openSlot){ open.add(_openSlot); _openSlot=null; }
  if(!open.size){
    try{ const s=localStorage.getItem(LS_OPEN); if(s&&SLOTS.includes(s)) open.add(s); }catch(e){}
  }
  const focus=_gearFocus; _gearFocus=null;
  const mobileQa=typeof matchMedia==="function"&&matchMedia("(max-width:520px)").matches;

  document.getElementById("gear").innerHTML=SLOTS.map(sl=>{
    const g=S.gear[sl],rolls=g&&g.rolls?g.rolls:[],e=itemBudget(sl);
    const libItem=g?libByName(g.item):null;
    const fixedN=libItem?(libItem.rolls||[]).length:0;
    const needsPick=!!(libItem&&libItem.rolledSec);
    const eff=e?`<span class="eff ${e.offShare>=60?'hi':e.offShare>=40?'mid':'lo'}" title="share of this item's level spent on offensive attributes">offense ${e.offShare}%</span>`:"";
    const pickNote=needsPick
      ? `<div class="note info secpick-note"><b>Secondary stat pick</b> — extra secondaries on this item are <b>random rolls</b>, not fixed.
         Choose the ones on your piece below (or BiS choices), then set their values.</div>` : "";
    const rollHtml=rolls.map((r,i)=>{
      const head=needsPick&&i===fixedN?pickNote:"";
      const locked=!!(libItem&&i<fixedN);
      return head+rollRow(sl,i,r,needsPick&&i>=fixedN,locked);
    }).join("")+(needsPick&&rolls.length<=fixedN?pickNote:"");
    const lib=libFor(sl);
    const copySources=SLOTS.filter(s=>s!==sl&&S.gear[s]&&(S.gear[s].rolls||[]).some(r=>!r.p&&r.s));
    return `<details class="slot"${open.has(sl)?" open":""} data-slot="${sl}"><summary>
      <span class="slotname">${sl}</span>
      <span class="itemname ${g?'':'empty'}">${g?esc(g.item):(SLOT_HINT[sl]?'empty — '+SLOT_HINT[sl]:'empty')}</span>
      ${e?`<span class="ilvl">i${e.level}</span>`:''}${eff}</summary>
      <div class="body">
        ${tooltipHtml(sl)}
        ${lib.length?`<div class="libwrap">
          <input class="libfilter" type="search" placeholder="Search ${sl} items (${lib.length})…"
            aria-label="Search documented ${sl} items" autocomplete="off"
            oninput="libSearch('${sl}',this.value)" onfocus="libSearch('${sl}',this.value)"
            onkeydown="libSearchKey(event,'${sl}')">
          <div class="libhits" id="libhits_${sl.replace(/\s/g,'_')}" hidden></div>
        </div>`:""}
        <details class="qa"${qaOpen.has(sl)||(mobileQa&&open.has(sl))?" open":""}><summary>Paste tooltip lines</summary>
          <textarea id="qa_${sl.replace(/\s/g,'_')}" class="qabox" rows="4"
            placeholder="+13 Power&#10;+28 Vitality&#10;+35% Critical Strike Damage&#10;[Gun] +24% Attack Speed&#10;&#10;Fastest way to enter a piece — paste from the game."></textarea>
          <button class="addbtn" onclick="quickAdd('${sl}')">Add pasted rolls</button>
        </details>
        <div class="nameRow">
          <input class="itemname-edit" placeholder="Item name" aria-label="Item name for ${sl}" value="${g?esc(g.item):''}" oninput="setName('${sl}',this.value)" onchange="save()">
          ${ACCESSORY.has(sl)||!e?'':`<span class="lvbadge" title="item level = sum of primary attribute points">iLvl ${e.level}</span>`}
        </div>
        ${g?fxHtml(fxFor(g.item)):""}
        ${rollHtml}
        ${ACCESSORY.has(sl)?'':`<button class="addbtn" onclick="addRoll('${sl}',1)">+ primary (attribute)</button>`}
        <button class="addbtn" onclick="addRoll('${sl}',0)">+ secondary</button>
        ${copySources.length?`<select class="pick" style="margin-top:6px" aria-label="Copy secondaries into ${sl}"
          onchange="copySecsFrom('${sl}',this.value);this.value=''">
          <option value="">— copy secondaries from slot —</option>
          ${copySources.map(s=>`<option value="${s}">${s}${S.gear[s].item?": "+esc(S.gear[s].item):""}</option>`).join("")}
        </select>`:""}
        ${g?`<button class="addbtn" style="background:#2a1620;color:#e08596;border-color:#3a2330" onclick="clearSlot('${sl}')">clear</button>`:''}
      </div></details>`;}).join("");

  document.querySelectorAll("#gear details.slot").forEach(d=>{
    d.addEventListener("toggle",()=>{
      const name=d.getAttribute("data-slot")||d.querySelector(".slotname")?.textContent;
      if(!name) return;
      try{
        if(d.open) localStorage.setItem(LS_OPEN,name);
        else if(localStorage.getItem(LS_OPEN)===name) localStorage.removeItem(LS_OPEN);
      }catch(e){}
    });
  });

  if(focus&&focus.sl!=="__cmp"){
    const slot=[...document.querySelectorAll("#gear details.slot")]
      .find(d=>(d.getAttribute("data-slot")||d.querySelector(".slotname")?.textContent)===focus.sl);
    const row=slot?.querySelectorAll(".rollrow")[focus.i];
    const el=focus.which==="v"?row?.querySelector("input[type=number]")
      :focus.which==="t"?row?.querySelector("select.tagsel")
      :row?.querySelector("select:not(.tagsel)");
    if(el){ el.focus(); if(el.select) try{ el.select(); }catch(e){} }
  }
}
function libOptionLabel(g){
  const rar=g.rarity?g.rarity[0].toUpperCase()+g.rarity.slice(1)+" · ":"";
  const lv=g.lvl?` (iL${g.lvl})`:"";
  const rnd=g.rolledSec?` · ${g.rolledSec} random sec`:"";
  return `${rar}${g.name}${lv}${rnd}`;
}
function libHitsId(sl){ return "libhits_"+(sl==="__cmp"?"__cmp":sl.replace(/\s/g,"_")); }
function libMatches(slot,q){
  const lib=libFor(slot==="__cmp"?((S.compare&&S.compare.slot)||"Chest"):slot);
  const qq=String(q||"").trim().toLowerCase();
  return lib.map((g,i)=>({g,i,label:libOptionLabel(g)}))
    .filter(x=>!qq||x.label.toLowerCase().includes(qq)||x.g.name.toLowerCase().includes(qq));
}
function renderLibHits(sl,q){
  const box=document.getElementById(libHitsId(sl)); if(!box) return;
  const hits=libMatches(sl,q);
  _libActive=0;
  if(!hits.length){
    box.hidden=false;
    box.innerHTML=`<div class="libempty">No matches</div>`;
    return;
  }
  box.hidden=false;
  box.innerHTML=hits.map((x,hi)=>`<button type="button" class="libhit${hi===0?" active":""}" data-i="${x.i}" data-hi="${hi}"
      onmousedown="event.preventDefault()" onclick="libPick('${sl}',${x.i})">
      ${esc(x.g.name)}<div class="meta">${esc(libOptionLabel(x.g))}</div>
    </button>`).join("");
}
function libSearch(sl,q){ renderLibHits(sl,q); }
function libSearchCmp(q){ renderLibHits("__cmp",q); }
function libPick(sl,idx){
  const box=document.getElementById(libHitsId(sl));
  if(box){ box.hidden=true; box.innerHTML=""; }
  if(sl==="__cmp") loadFromLib(String(idx));
  else equipFromLib(sl,String(idx));
}
let _libActive=0;
function libSearchKey(e,sl){
  const box=document.getElementById(libHitsId(sl));
  if(!box||box.hidden){
    if(e.key==="ArrowDown"){ e.preventDefault(); renderLibHits(sl,e.target.value); return; }
    return;
  }
  const hits=[...box.querySelectorAll(".libhit")];
  if(e.key==="Escape"){ e.preventDefault(); box.hidden=true; return; }
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){
    e.preventDefault();
    if(!hits.length) return;
    hits[_libActive]?.classList.remove("active");
    _libActive=(e.key==="ArrowDown"?_libActive+1:_libActive-1+hits.length)%hits.length;
    hits[_libActive]?.classList.add("active");
    hits[_libActive]?.scrollIntoView({block:"nearest"});
    return;
  }
  if(e.key==="Enter"){
    e.preventDefault();
    const hit=hits[_libActive]||hits[0];
    if(hit) libPick(sl,hit.getAttribute("data-i"));
  }
}
// Close result popups when clicking elsewhere
document.addEventListener("click",e=>{
  if(e.target.closest(".libwrap")) return;
  document.querySelectorAll(".libhits").forEach(b=>{ b.hidden=true; });
});
function rollRow(sl,i,r,isPick,locked){
  const opts=r.p?AKEYS.map(k=>`<option value="${k}" ${k===r.s?'selected':''}>${ATTRS[k].name}</option>`).join("")
                :`${isPick||!r.s?`<option value="">— pick a secondary —</option>`:""}${SECKEYS.map(k=>`<option value="${k}" ${k===r.s?'selected':''}>${SEC[k]}</option>`).join("")}`;
  const kind=locked?'fixed':(r.p?'primary':(isPick?'pick':'secondary'));
  const dis=locked?" disabled":"";
  return `<div class="rollrow${locked?" locked":""}"><span class="kind ${locked?'fixed':(isPick?'pick':'')}">${kind}</span>
    <select${dis} aria-label="${sl} roll ${i+1} stat" onchange="setRoll('${sl}',${i},'s',this.value)">${opts}</select>
    <input type="number" step="0.05" value="${r.v}"${dis}
      aria-label="${sl} roll ${i+1} value"
      onchange="setRoll('${sl}',${i},'v',this.value)"
      ${isPick?`onkeydown="pickValueKey(event,'${sl}',${i})"`:""}
      ${isPick&&!r.s?' placeholder="value"':''}>
    ${r.p||locked?'':`<select class="tagsel" title="Limits this roll to certain abilities" aria-label="${sl} roll ${i+1} — limit to abilities" onchange="setTag('${sl}',${i},this.value)">
      <option value="">all abilities</option>
      <optgroup label="Category (multiple abilities)">${["gun","elemental","throwable","explosion","physical","melee","sphere","weapon","heal","support"]
        .map(k=>`<option value="${k}" ${r.t===k?'selected':''}>[${TAG_NAME[k]}]</option>`).join("")}</optgroup>
      <optgroup label="Single ability">${["gleamtwins","pyrosphere","chakram","drone"]
        .map(k=>`<option value="${k}" ${r.t===k?'selected':''}>[${TAG_NAME[k]}]</option>`).join("")}</optgroup>
    </select>`}
    ${locked?"":`<button type="button" class="dup" title="Duplicate this roll" aria-label="Duplicate ${sl} roll ${i+1}" onclick="dupRoll('${sl}',${i})">⧉</button>
    <button type="button" onclick="delRoll('${sl}',${i})" title="Remove roll" aria-label="Remove ${sl} roll ${i+1}">✕</button>`}
    ${locked?`<span class="kind fixed" title="Fixed on this documented item">locked</span>`:""}</div>`;
}
function renderDisc(){
  /* The disclaimer is static markup in the footer -- the Third-Party Extensions
     Policy requires it verbatim, and a reader with JS off is still a reader.
     Nothing to render; kept as a no-op so the render() sequence is unchanged. */
}
function renderDiscUnused(){
  document.getElementById("disc").innerHTML=
    `<b>This project is an independent creation and is not affiliated with, endorsed, or sponsored by Soulbound.</b> `+
    `View the official Fan Content Policy at `+
    `<a href="https://soulbound.game/legal-portal/fan-content" rel="noopener">soulbound.game/legal-portal/fan-content</a>.`+
    `<br><br>All game names and trademarks belong to their respective owners. Values are community-maintained `+
    `approximations that can change with game updates — always trust your in-game stat panel over this tool. `+
    `Builds are saved in your own browser as you edit (never uploaded) — press <b>Reset</b> to clear them; `+
    `share links encode the build in the URL itself.`+
    `<br><br>Open source — <a href="https://github.com/rages4calm/arcadia" rel="noopener">view or contribute on GitHub</a>. `+
    `Spotted a wrong number, or an item that's missing? Open an issue.`;
}


/* ═══════════ EDIT OPS ═══════════ */
const gearOf=sl=> sl==="__cmp" ? (S.compare||(S.compare={slot:"Chest",item:"",rolls:[]})) : S.gear[sl];
const round=n=>Math.round(n*100)/100;
function setCmpSlot(v){ S.compare.slot=v; save(); }
function fxFor(name){
  const g=GEAR_LIB.find(x=>x.name===name&&x.fx); return g?g.fx:null;
}


function hiddenFor(name){
  if(!name) return null;
  return HIDDEN_INDEX[String(name).toLowerCase().replace(/\s+/g," ").trim()]||null;
}

function ttStatLine(r){
  if(!r.p && !r.s){
    return `<div class="ttrow ttph"><span class="ttv">&lt;secondary&gt;</span></div>`;
  }
  const pct=r.p?false:/%/.test(SEC[r.s]||"");
  const label=r.p?(ATTRS[r.s]?ATTRS[r.s].name:r.s):(SEC[r.s]||r.s).replace(/\s*%$/,"");
  const tag=r.t?`[${TAG_NAME[r.t]||r.t}] `:"";
  const v=(r.v>0?"+":"")+r.v+(pct?"%":"");
  return `<div class="ttrow"><span class="ttv">${esc(v)}</span><span class="ttl">${esc(tag+label)}</span></div>`;
}
function tooltipHtml(sl){
  const g=S.gear[sl];
  if(!g||!g.item&&!(g.rolls||[]).length) return "";
  const rolls=g.rolls||[];
  const prim=rolls.filter(r=>r.p&&AKEYS.includes(r.s));
  // Keep empty rolled-sec slots so the card shows <secondary> until the user picks.
  const sec=rolls.filter(r=>!r.p);
  const e=itemBudget(sl);
  const kn=hiddenFor(g.item);

  let hidden;
  if(kn&&(kn.stat||kn.proc||kn.fx)){
    const bits=[];
    if(kn.stat){
      const m=/^([+\-]?[\d.]+%?)\s+(.*)$/.exec(kn.stat);
      bits.push(`<div class="ttrow"><span class="ttv">${esc(m?m[1]:kn.stat)}</span>${m?`<span class="ttl">${esc(m[2])}</span>`:""}</div>`);
      const why=m&&HIDDEN_WHY[m[2]];
      if(why) bits.push(`<div class="ttnote">${esc(why)}</div>`);
    }
    const vars=(kn.procs||[]).filter((p,i,a)=>a.findIndex(q=>q.effect===p.effect&&q.trigger===p.trigger)===i);
    if(vars.length>1){
      // Same name, different tiers, different effects. Say which is which rather
      // than picking one -- the item level in the header tells them apart.
      vars.forEach(p=>{
        const tier=(/t(\d)/i.exec(p.pat||"")||[])[1];
        bits.push(`<div class="ttrow"><span class="ttv">${esc(p.trigger)}</span>
          <span class="ttl">${tier?`<b>T${esc(tier)}</b> `:""}${esc(p.effect)}${p.scope?` [${esc(fxLabel(p.scope))}]`:""} · ${p.chance}%</span></div>`);
      });
      bits.push(`<div class="ttnote">Two tiers share this name and their effects differ — check the item level above.</div>`);
    }
    else if(kn.proc) bits.push(`<div class="ttrow"><span class="ttv">${esc(kn.proc.trigger)}</span>
      <span class="ttl">${esc(kn.proc.effect)}${kn.proc.scope?` [${esc(fxLabel(kn.proc.scope))}]`:""} · ${kn.proc.chance}%</span></div>`);
    else if(kn.fx) bits.push(`<div class="ttrow"><span class="ttv">${esc(kn.fx.trigger)}</span>
      <span class="ttl">${esc(kn.fx.effect)}${kn.fx.scope?` [${esc(fxLabel(kn.fx.scope))}]`:""}</span></div>`);
    hidden=`<div class="tthead">Not on the in-game tooltip</div>${bits.join("")}
      ${kn.proc||kn.fx?`<div class="ttnote">Only a Legendary copy carries this. A lower-rarity one of the same item has nothing.</div>`:""}`;
  }else if(kn){
    hidden=`<div class="tthead">Not on the in-game tooltip</div>
      <div class="ttnote">Nothing hidden on this one — it's been checked.</div>`;
  }else{
    hidden=`<div class="tthead dim">Not on the in-game tooltip</div>
      <div class="ttnote">This item hasn't been recorded yet, so we can't say either way.
        Type its name exactly as the game spells it to check.</div>`;
  }

  return `<div class="tt">
    <div class="ttname">${esc(g.item||"Unnamed item")}</div>
    <div class="ttsub">${esc(sl)}${e?` &middot; Level ${e.level}`:""}</div>
    ${prim.length?`<div class="tthead">Primary</div>${prim.map(ttStatLine).join("")}`:""}
    ${sec.length?`<div class="tthead">Secondary</div>${sec.map(ttStatLine).join("")}`:""}
    <div class="ttrule"></div>
    ${hidden}
  </div>`;
}
// A proc's scope can name an ability TAG (gun, throwable...), a DAMAGE TYPE (fire,
// void, cold...), or an ability ID outright (pyrosphere). Pyrosphere is
// tags:[sphere,elemental] but type FIRE, so a [fire]-scoped proc has to match on
// type as well as tags.
//
// Some scopes are compound: [bomb_explosion] means the bomb's explosion, and matches
// only an ability that satisfies BOTH halves — id/tag "bomb" and tag "explosion".
// Requiring every part keeps a compound scope from over-matching every explosive.
function fxOne(part,a){
  return tagMatches(part,a) || (a.type||"").toLowerCase()===part.toLowerCase();
}
function fxMatches(scope,a){
  if(!scope) return false;
  if(fxOne(scope,a)) return true;
  const alias=SCOPE_ALIAS[String(scope).toLowerCase()];
  if(alias && fxOne(alias,a)) return true;
  const parts=scope.split("_");
  return parts.length>1 && parts.every(p=>fxOne(p,a));
}
function fxLabel(s){
  if(TAG_NAME[s]) return TAG_NAME[s];
  if(!s) return s;
  const t=s.replace(/_/g," ");           // bomb_explosion -> "Bomb explosion"
  return t[0].toUpperCase()+t.slice(1);
}
function fxHtml(fx){
  if(!fx) return "";
  const hits=ABILITIES.filter(a=>fxMatches(fx.scope,a)).map(a=>a.name);
  const yours=equipped().filter(a=>fxMatches(fx.scope,a)).map(a=>a.name);
  return `<div class="fxbox">
    <span class="fxtag">hidden effect</span>
    <b>${fx.trigger}</b> → ${esc(fx.effect)}
    <div class="fxwho">Trigger rate isn't shown in-game and changes with patches — treat this as
      "it has a proc", not a rate. Scoped to <code>[${fxLabel(fx.scope)}]</code> — applies to ${hits.join(", ")||"—"}.
      ${yours.length?`You run <b>${yours.join(", ")}</b>, so you get it.`
                    :`<span style="color:var(--warn)">Nothing you have equipped matches, so this does nothing for your current loadout.</span>`}</div>
  </div>`;
}
function libFor(slot){
  const s = slot.startsWith("Ring") ? "Ring 1" : slot;
  return GEAR_LIB.filter(g=>g.slot===s);
}
function libByName(name){
  if(!name) return null;
  return GEAR_LIB.find(x=>x.name===name)||null;
}
/* Fixed rolls from the library, plus empty slots for random secondaries
   (rolledSec). Caller fills those in — sample CDR/Healing values aren't hardcoded.
   Lower rarities often roll one fewer random secondary than the legendary template. */

function rolledSecCount(g, rarity){
  const r=String(rarity||"").toLowerCase();
  if(g.pk){
    const rank=(r in RARITY_RANK) ? RARITY_RANK[r]
             : (RARITY_RANK[String(g.rarity||"").toLowerCase()]);
    const hit=(rank!=null) ? g.pk[String(rank)] : null;
    if(hit!=null) return Math.max(0, +hit);
  }
  let n=+g.rolledSec||0;
  if(!n || !r) return n;
  if(r==="legendary") return n;
  if(r==="epic" || r==="rare") return Math.max(0, n-1);
  if(r==="uncommon" || r==="common") return Math.max(0, n-2);
  return n;
}
function materializeLibItem(g, rarity){
  const rolls=JSON.parse(JSON.stringify(g.rolls||[]));
  const n=rolledSecCount(g, rarity);
  for(let i=0;i<n;i++) rolls.push({s:"",p:0,v:0});
  return {item:g.name, lv:g.lvl!=null?+g.lvl:0, rolls};
}
function loadFromLib(idx){
  if(idx==="") return;
  const g=libFor(S.compare.slot)[+idx]; if(!g) return;
  const m=materializeLibItem(g);
  S.compare={slot:S.compare.slot,item:m.item,rolls:m.rolls};
  save(); toast(`Loaded ${g.name}`);
}
function equipFromLib(slot,idx){
  if(idx==="") return;
  const g=libFor(slot)[+idx]; if(!g) return;
  S.gear[slot]=materializeLibItem(g);
  _openSlot=slot;
  save(); toast(`Equipped ${g.name}`);
}
function setCmpName(v){ S.compare.item=v; persist(); }
function addCmpRoll(p){ const C=gearOf("__cmp");
  C.rolls.push(p?{s:ARMOUR.has(C.slot)?"vitality":"ferocity",p:1,v:0}:{s:"critical_strike_damage",p:0,v:0}); save(); }
function clearCmp(){ S.compare={slot:S.compare.slot,item:"",rolls:[]}; save(); }

function setLoadout(i,v){ S.loadout[i]=v; save(); }
/* Stores on every keystroke but does NOT re-render: render() rebuilds the gear
   editor, which would destroy the input being typed into. The name is what looks up
   the legendary effect, the hidden stats and the tooltip, so those panels have to
   refresh at some point -- the input's onchange fires that on blur or Enter, once
   the name is actually finished. Before this, editing a name saved it but updated
   nothing, and the only way to see the effect was to touch a value and undo it. */
function setName(sl,v){ if(!S.gear[sl])S.gear[sl]={item:v,lv:0,rolls:[]}; S.gear[sl].item=v; persist(); }
function setLv(sl,v){ if(!S.gear[sl])S.gear[sl]={item:"New item",lv:0,rolls:[]}; S.gear[sl].lv=+v||0; save(); }
let _gearFocus=null;
let _openSlot=null;
function setRoll(sl,i,f,v){
  const g=gearOf(sl); if(!g||!g.rolls[i]) return;
  if(rollLocked(sl,i)&&(f==="s"||f==="v")) return;
  const r=g.rolls[i]; r[f]=f==='v'?(+v||0):v;
  // After picking a stat, jump to the value field; keep the slot open via renderGear.
  if(sl!=="__cmp") _gearFocus={sl,i,which:f==="s"?"v":f};
  save();
}
function setTag(sl,i,tag){
  if(rollLocked(sl,i)) return;
  const r=gearOf(sl).rolls[i]; if(tag)r.t=tag; else delete r.t;
  if(sl!=="__cmp") _gearFocus={sl,i,which:"t"};
  save();
}
function rollLocked(sl,i){
  const item=sl==="__cmp"?(S.compare&&S.compare.item):(S.gear[sl]&&S.gear[sl].item);
  const lib=libByName(item);
  return !!(lib&&i<(lib.rolls||[]).length);
}
function delRoll(sl,i){
  if(rollLocked(sl,i)){ toast("That line is fixed on this item"); return; }
  gearOf(sl).rolls.splice(i,1);
  if(sl!=="__cmp") _gearFocus={sl,i:Math.max(0,i-1),which:"s"};
  save();
}
function dupRoll(sl,i){
  if(rollLocked(sl,i)) return;
  const g=gearOf(sl); if(!g||!g.rolls[i]) return;
  const copy=JSON.parse(JSON.stringify(g.rolls[i]));
  g.rolls.splice(i+1,0,copy);
  if(sl!=="__cmp"){ _openSlot=sl==="__cmp"?null:sl; _gearFocus={sl,i:i+1,which:"s"}; }
  save();
}
function copySecsFrom(sl,from){
  if(!from||from===sl) return;
  const src=S.gear[from]; if(!src) return;
  const secs=(src.rolls||[]).filter(r=>!r.p&&r.s).map(r=>{
    const o={s:r.s,p:0,v:+r.v||0}; if(r.t) o.t=r.t; return o;
  });
  if(!secs.length){ toast("No secondaries to copy"); return; }
  if(!S.gear[sl]) S.gear[sl]={item:"New item",lv:0,rolls:[]};
  const g=S.gear[sl];
  const lib=libByName(g.item);
  const fixedN=lib?(lib.rolls||[]).length:0;
  const kept=fixedN?(g.rolls||[]).slice(0,fixedN):(g.rolls||[]).filter(r=>r.p);
  g.rolls=kept.concat(secs);
  _openSlot=sl;
  save(); toast(`Copied ${secs.length} secondaries from ${from}`);
}
function pickValueKey(e,sl,i){
  if(e.key!=="Enter"&&!(e.key==="Tab"&&!e.shiftKey)) return;
  const g=gearOf(sl); if(!g||!g.rolls[i]) return;
  g.rolls[i].v=+e.target.value||0;
  const item=sl==="__cmp"?(S.compare&&S.compare.item):g.item;
  const lib=libByName(item);
  const fixedN=lib?(lib.rolls||[]).length:0;
  let next=-1;
  for(let j=i+1;j<(g.rolls||[]).length;j++){
    if(!g.rolls[j].p&&(!lib||j>=fixedN)){ next=j; break; }
  }
  if(e.key==="Enter"||next>=0){
    e.preventDefault();
    persist();
    if(sl==="__cmp"){ save(); return; }
    _gearFocus={sl,i:next>=0?next:i,which:next>=0?"s":"v"};
    save();
  }
}
function addRoll(sl,p){ if(!S.gear[sl])S.gear[sl]={item:"New item",lv:0,rolls:[]};
  S.gear[sl].rolls.push(p?{s:ARMOUR.has(sl)?"vitality":"ferocity",p:1,v:0}:{s:"critical_strike_damage",p:0,v:0});
  if(sl!=="__cmp") _gearFocus={sl,i:S.gear[sl].rolls.length-1,which:"s"};
  save(); }
function clearSlot(sl){ S.gear[sl]=null; save(); }

document.getElementById("shareBtn").onclick=()=>shareLink();

const pubPanel=document.getElementById("pubPanel");
document.getElementById("pubBtn").onclick=()=>{
  if(!equipped().length && !hasPrimaries()){ toast("Add some gear or abilities first"); return; }
  pubPanel.hidden=false;
  document.getElementById("pubTitle").focus();
};
document.getElementById("pubCancel").onclick=()=>{ pubPanel.hidden=true; };
/* Live character count. The server rejects over 800, and finding that out only
   after clicking Publish would lose whatever they had typed. */
(()=>{
  const ta=document.getElementById("pubNotes"), out=document.getElementById("pubNotesCount");
  if(!ta||!out) return;
  const upd=()=>{ const n=ta.value.length;
    out.textContent = n ? `${n} / 800` : "";
    out.style.color = n>760 ? "var(--gold)" : "var(--faint)"; };
  ta.addEventListener("input",upd); upd();
})();
document.getElementById("pubGo").onclick=async()=>{
  const title=document.getElementById("pubTitle").value.trim();
  const author=document.getElementById("pubAuthor").value.trim();
  const notes=document.getElementById("pubNotes").value.trim();
  const msg=document.getElementById("pubMsg");
  if(title.length<3){ msg.className="note warn"; msg.textContent="Give it a name first (at least 3 characters)."; return; }
  msg.className="note"; msg.textContent="Publishing…";
  try{
    const code=await encodeBuild();
    // store the build to get an id, then flag that id as published
    const r1=await fetch("/api/build.php",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({p:code})});
    if(!r1.ok) throw new Error("share");
    const {id}=await r1.json();
    const t=attrTotals();
    const r2=await fetch("/api/gallery.php",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"publish",id,title,author,notes,
        summary:{abilities:S.loadout.filter(Boolean),attrs:AKEYS.map(k=>t[k])}})});
    if(!r2.ok){ const e=await r2.json().catch(()=>({})); throw new Error(e.error||"publish"); }
    msg.className="note good";
    msg.innerHTML=`Published. <a href="/gallery.html" style="color:var(--acc2)">See it in the gallery</a> · `+
                  `link: <code>${location.origin}/b/${id}</code>`;
    toast("Published to the gallery");
  }catch(e){
    msg.className="note bad";
    msg.textContent = String(e.message)==="share"
      ? "Couldn't reach the server, so publishing isn't available right now. Sharing by link still works."
      : "Couldn't publish: "+e.message;
  }
};
document.getElementById("exampleBtn").onclick=()=>{ S=normalise(clone(EXAMPLE)); save(); };
document.getElementById("clearBtn").onclick=()=>{
  // Keep a copy so the reset is undoable — this wipes gear, abilities and
  // localStorage, and the button sits next to entirely harmless ones.
  const prev=clone(S);
  S={loadout:["","","",""],gear:blankGear(),compare:{slot:"Chest",item:"",rolls:[]}};
  try{ localStorage.removeItem(LS); }catch(e){}
  // location.origin is "file://" on a local copy, so origin+"/" would navigate
  // away from the file itself. pathname drops the hash and keeps the page.
  history.replaceState(null,"",location.pathname);
  render();
  toast("Reset — nothing saved in this browser", ()=>{ S=prev; save(); toast("Reset undone"); });
};
document.getElementById("exportBtn").onclick=()=>{ const b=new Blob([JSON.stringify(S,null,1)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="arcadia-build.json"; a.click(); };
document.getElementById("importBtn").onclick=()=>document.getElementById("importFile").click();
document.getElementById("importFile").onchange=e=>{const f=e.target.files[0]; if(!f)return;
  const rd=new FileReader(); rd.onload=()=>{ try{const d=JSON.parse(rd.result);
    if(d&&d.gear){ S=normalise(d); save(); } else alert("Not a build file");}catch(err){alert("Invalid JSON");}};
  rd.readAsText(f);};
function esc(s){ return (s||"").replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
wireShotImport();
render();
