/* Arcadia game data. No logic lives here -- that is app.js.

   THIS FILE IS THE SOURCE. Edit it to add or correct an item, effect or relic.
   items.json and relics.json are GENERATED from it and must not be hand-edited;
   they are rebuilt when a change is deployed, so an edit made there is lost.

   Loaded before app.js by a plain <script src>, so these top-level consts land
   in the shared global lexical scope.

   The big datasets are written one entry per line on purpose: as a single line
   git cannot merge two people adding different items. Keep it that way. */
/* Percentage stats follow a saturating curve  y = a*p/(p+b)  (p = points above the
   base of 1): a is the ceiling, b the points needed to reach half of it. Flat stats
   (health, regen) are strictly linear. Curves marked `fit` are measured; the rest
   share the same shape but their constants aren't pinned down yet. */
const ATTRS = {
  power:     {name:"Power",     role:"off", gives:[
    {s:"Raw damage", d:"direct multiplier in the damage formula"}]},
  precision: {name:"Precision", role:"off", gives:[
    {s:"Crit Chance", d:"saturating"},
    {s:"Attack Speed", a:14.7, b:1.9, unit:"%", fit:1},
    {s:"Projectile Speed", a:0.25, b:17.6, fit:1}]},
  will:      {name:"Will",      role:"hyb", gives:[
    {s:"Cooldown Reduction", d:"saturating"},
    {s:"Stun Resistance", a:30, b:25, unit:"%", fit:1}]},
  ferocity:  {name:"Ferocity",  role:"off", gives:[
    {s:"Crit Damage", d:"saturating"},
    {s:"Heavy Hit Damage", d:"saturating"},
    {s:"Dot Potency", d:"saturating"}]},
  vitality:  {name:"Vitality",  role:"def", gives:[
    {s:"Max Health", lin:1.0, fit:1},
    {s:"Health Regen", lin:0.01, fit:1},
    {s:"All 6 Resistances", a:12, b:18, unit:"%", fit:1}]},
  focus:     {name:"Focus",     role:"off", gives:[
    {s:"Heavy Hit Chance", d:"saturating"},
    {s:"AoE Radius", d:"saturating"},
    {s:"Status Duration", d:"saturating"}]},
};
const AKEYS=Object.keys(ATTRS), ATTR_BASE=1, HP_BASE=100;
const SCALE={vit:0.62, off:0.19};
/* The server names some scopes differently from our ability ids ("blackholebomb"
   for bomb_blackhole) and some name a weapon class or a debuff rather than an
   ability ("greatsword", "chill"). Without these, fxMatches resolved six shipped
   scopes to nothing and reported a false negative. */
const SCOPE_ALIAS = {blackholebomb:"bomb_blackhole", blackhole:"bomb_blackhole",
  chill:"icecube", sword:"melee_weapon", greatsword:"greatsword_weapon",
  gleamtwins:"smg_gleamtwins", hammer:"hammer_weapon", staff:"staff_weapon"};
const ABILITIES = [
  {id:"bomb_blackhole", name:"Blackhole Bomb", type:"VOID",      by:["precision","will","focus"],     tags:["throwable","explosion"]},
  {id:"bomb",           name:"Bomb",           type:"EXPLOSIVE", by:["precision","will","focus"],     tags:["throwable","explosion"]},
  {id:"chain_lightning",name:"Chain Lightning",type:"LIGHTNING", by:["power","ferocity","focus"],     tags:["elemental"]},
  {id:"chakram",        name:"Chakram",        type:"PHYSICAL",  by:["precision","ferocity","focus"], tags:["throwable","physical"]},
  {id:"drone",          name:"Drone",          type:"EXPLOSIVE", by:["power","ferocity","focus"],     tags:["explosion"]},
  {id:"fortify",        name:"Fortify",        type:"SHIELDING", by:["power","will","ferocity"],      tags:["support","non_damaging"]},
  {id:"smg_gleamtwins", name:"Gleam Twins",    type:"VOID",      by:["precision","ferocity","focus"], tags:["gun"]},
  {id:"healing_pulse",  name:"Healing Pulse",  type:"HEALING",   by:["power","focus","will"],         tags:["heal","support_pulse","non_damaging"]},
  {id:"icecube",        name:"Ice Cube",       type:"COLD",      by:["will","ferocity","focus"],      tags:["elemental"]},
  {id:"kusarigama",     name:"Kusarigama",     type:"PHYSICAL",  by:["power","precision","will"],     tags:["throwable","physical"]},
  {id:"machinegun",     name:"Machinegun",     type:"EXPLOSIVE", by:["power","precision","ferocity"], tags:["gun"]},
  {id:"minigun",        name:"Minigun",        type:"PHYSICAL",  by:["power","precision","ferocity"], tags:["gun"]},
  {id:"pyrosphere",     name:"Pyrosphere",     type:"FIRE",      by:["will","ferocity","focus"],      tags:["sphere","elemental"]},
  {id:"melee_weapon",   name:"Melee weapon attack", type:"PHYSICAL", by:["power","precision","focus"],tags:["melee","weapon"]},
  {id:"staff_weapon",   name:"Staff weapon attack", type:"VOID", by:["focus","will","ferocity"],      tags:["sphere","weapon"]},
  // The two-handers scale differently from the one-handed melee entry above, so
  // they need their own rows rather than folding into "Melee weapon attack".
  {id:"hammer_weapon",  name:"Axe / Hammer attack", type:"PHYSICAL", by:["power","precision","focus"], tags:["melee","weapon","physical"]},
  {id:"greatsword_weapon", name:"Greatsword attack", type:"PHYSICAL", by:["power","will","ferocity"],  tags:["melee","slam","weapon","physical"]},
];
/* Base impact and cooldown as the game reports them. Impact is damage PER HIT,
   which is why no rate is derived from it here - abilities that fire over a
   duration land many hits per cast. */
const ABIL_STATS={"kusarigama":{"d":110,"cd":5.7},"bomb":{"d":90,"cd":6.1},"chain_lightning":{"d":120,"cd":3.7},"icecube":{"d":117,"cd":4.9},"fortify":{"d":160,"cd":13.0},"healing_pulse":{"d":31,"cd":19.5},"drone":{"d":117,"cd":3.3},"minigun":{"d":89,"cd":2.8},"hammer_weapon":{"d":122,"cd":1.8},"greatsword_weapon":{"d":177,"cd":1.4},"melee_weapon":{"d":122,"cd":1.0},"chakram":{"d":109,"cd":5.7},"bomb_blackhole":{"d":88,"cd":4.9},"machinegun":{"d":4,"cd":3.4},"pyrosphere":{"d":138,"cd":2.8},"smg_gleamtwins":{"d":45,"cd":4.9},"staff_weapon":{"d":148,"cd":1.2}};
const ABIL_WEAK=(()=>{
  const v=Object.values(ABIL_STATS).map(s=>s.d).filter(x=>x!=null).sort((a,b)=>a-b);
  return v.length? v[Math.floor(v.length/2)]*0.25 : 0;
})();
/* Ability-scoping tags. A gear roll tagged X applies to every ability whose own
   tag list contains X, or whose id is X. So [Gun] is a CATEGORY (3 abilities),
   while [Pyrosphere] targets a single ability. */
const TAG_KEYS=["gun","gleamtwins","pyrosphere","chakram","drone","elemental","throwable",
                "explosion","physical","melee","sphere","weapon","heal","support"];
const TAG_NAME={gun:"Gun",gleamtwins:"Gleam Twins",pyrosphere:"Pyrosphere",chakram:"Chakram",
  drone:"Drone",elemental:"Elemental",throwable:"Throwable",explosion:"Explosion",
  physical:"Physical",melee:"Melee",sphere:"Sphere",weapon:"Weapon",heal:"Heal",support:"Support"};
const GEAR_LIB = [
  {"slot":"Arms","name":"Encoded Staff","rarity":"uncommon","lvl":22,"rolls":[{"s":"will","p":1,"v":7},{"s":"precision","p":1,"v":8},{"s":"focus","p":1,"v":7},{"s":"shielding_power","p":0,"v":21.0}]},
  {"slot":"Arms","name":"Voltlite Staff","rarity":"","lvl":22,"fx":{"trigger":"on enemy kill","scope":"fire","effect":"Power buff to your fire abilities"},"rolls":[{"s":"will","p":1,"v":7},{"s":"ferocity","p":1,"v":8},{"s":"focus","p":1,"v":7},{"s":"dot_potency","p":0,"v":28.0},{"s":"cooldown_reduction","p":0,"v":3.5}]},
  {"slot":"Arms","name":"Tritanium Hammer","rarity":"legendary","lvl":29,"rolledSec":2,"fx":{"trigger":"on heavy hit","scope":"","effect":"Large Cooldown Reduction buff for a short duration"},"rolls":[{"s":"power","p":1,"v":10},{"s":"precision","p":1,"v":10},{"s":"focus","p":1,"v":9}]},
  {"slot":"Arms","name":"Viridium Greatsword","rarity":"legendary","lvl":36,"rolls":[{"s":"power","p":1,"v":12},{"s":"will","p":1,"v":12},{"s":"ferocity","p":1,"v":12},{"s":"health","p":0,"v":80.0},{"s":"shielding_power","p":0,"v":28.0}]},
  {"slot":"Arms","name":"Viridium Yoku Hammer","rarity":"legendary","lvl":36,"rolledSec":2,"fx":{"trigger":"on melee crit","scope":"melee","effect":"+100% threat generation briefly"},"rolls":[{"s":"power","p":1,"v":12},{"s":"will","p":1,"v":12},{"s":"focus","p":1,"v":12}]},
  {"slot":"Arms","name":"Viridium Yoku Staff","rarity":"legendary","lvl":36,"rolledSec":2,"fx":{"trigger":"on impact end","scope":"pyrosphere","effect":"Hit 5+ enemies with Pyrosphere to create a shockwave from the impact"},"rolls":[{"s":"will","p":1,"v":12},{"s":"focus","p":1,"v":12},{"s":"ferocity","p":1,"v":12}]},
  /* Fixed: primaries + unique Link Count lines. rolledSec = random secondaries
     (CDR, Healing Power, Dot Potency, …) — not hardcoded; picker fills them in. */
  {"slot":"Arms","name":"Celestial Yoku Staff","rarity":"legendary","lvl":45,"rolledSec":2,"rolls":[{"s":"precision","p":1,"v":12},{"s":"focus","p":1,"v":16},{"s":"will","p":1,"v":17},{"s":"link_count_pct","p":0,"v":-100.0},{"s":"link_count","p":0,"v":8.0}]},
  {"slot":"Arms","name":"Redeemed Celestial Katana","rarity":"legendary","lvl":49,"rolls":[{"s":"power","p":1,"v":17},{"s":"focus","p":1,"v":16},{"s":"ferocity","p":1,"v":16},{"s":"attack_speed","p":0,"v":8.8},{"s":"duration","p":0,"v":35.0}]},
  {"slot":"Back","name":"Wanderer's Encoded Cloak","rarity":"rare","lvl":4,"rolls":[{"s":"will","p":1,"v":2},{"s":"focus","p":1,"v":2}]},
  {"slot":"Back","name":"Gecko Backpack","rarity":"epic","lvl":15,"rolledSec":1,"rolls":[{"s":"damage","p":0,"v":30},{"s":"health","p":0,"v":12},{"s":"dodge_chance","p":0,"v":2},{"s":"buff_power","p":0,"v":20}]},
  {"slot":"Back","name":"Starweave Armour","rarity":"epic","lvl":17,"rolls":[{"s":"damage","p":0,"v":98},{"s":"health","p":0,"v":123},{"s":"dodge_chance","p":0,"v":8},{"s":"cooldown_reduction","p":0,"v":3.5}]},
  {"slot":"Back","name":"Basalt Cloak","rarity":"rare","lvl":12,"rolls":[{"s":"damage","p":0,"v":5},{"s":"health","p":0,"v":15},{"s":"defense_rating","p":0,"v":7}]},
  {"slot":"Back","name":"Obsidian Trimmed Cloak","rarity":"rare","lvl":0,"rolls":[{"s":"damage","p":0,"v":18},{"s":"health","p":0,"v":10},{"s":"critical_strike_chance","p":0,"v":1}]},
  {"slot":"Belt","name":"Nihil Cinch","rarity":"rare","lvl":0,"rolls":[{"s":"void_damage","p":0,"v":20.0},{"s":"aoe_radius","p":0,"v":3.5},{"s":"critical_strike_damage","p":0,"v":12.0}]},
  {"slot":"Belt","name":"Glacial Girdle","rarity":"legendary","lvl":0,"rolls":[{"s":"cold_damage","p":0,"v":15.0},{"s":"cooldown_reduction","p":0,"v":1.75},{"s":"aoe_radius","p":0,"v":4.05}]},
  {"slot":"Chest","name":"Ferrox Plate Chest","rarity":"epic","lvl":47,"rolls":[{"s":"vitality","p":1,"v":29},{"s":"precision","p":1,"v":9},{"s":"will","p":1,"v":9},{"s":"critical_strike_damage","p":0,"v":26.0},{"s":"attack_speed","p":0,"v":6.6},{"s":"physical_damage","p":0,"v":6.6}]},
  {"slot":"Chest","name":"Voltscale Chest","rarity":"epic","lvl":47,"rolls":[{"s":"vitality","p":1,"v":29},{"s":"power","p":1,"v":9},{"s":"ferocity","p":1,"v":9},{"s":"attack_speed","p":0,"v":6.3},{"s":"physical_damage","p":0,"v":6.3},{"s":"heavy_hit_chance","p":0,"v":6.3}]},
  {"slot":"Chest","name":"Legendary chest (iL64)","rarity":"legendary","lvl":64,"fx":{"trigger":"on crit","scope":"gun","effect":"Power buff to your gun abilities — Gleam Twins, Minigun and Machinegun"},"rolls":[{"s":"vitality","p":1,"v":40},{"s":"power","p":1,"v":12},{"s":"ferocity","p":1,"v":12},{"s":"critical_strike_chance","p":0,"v":7.2},{"s":"critical_strike_damage","p":0,"v":31}]},
  {"slot":"Chest","name":"Midnight Kimono","rarity":"epic","lvl":64,"rolledSec":3,"rolls":[{"s":"vitality","p":1,"v":40},{"s":"precision","p":1,"v":12},{"s":"will","p":1,"v":12}]},
  {"slot":"Chest","name":"Virelda Warcrest Cuirass","rarity":"legendary","lvl":83,"rolledSec":2,"fx":{"trigger":"on melee crit","scope":"melee","effect":"+3% Physical damage for 5s, stacking up to 10"},"rolls":[{"s":"power","p":1,"v":15},{"s":"ferocity","p":1,"v":15},{"s":"vitality","p":1,"v":53}]},
  {"slot":"Chest","name":"Neotilus Trailseeker Coat","rarity":"legendary","lvl":83,"rolledSec":2,"fx":{"trigger":"on crit","scope":"explosive","effect":"10% chance to grant +1 Drone for 10s"},"rolls":[{"s":"power","p":1,"v":15},{"s":"precision","p":1,"v":15},{"s":"vitality","p":1,"v":53}]},
  {"slot":"Chest","name":"Lunar Conduit Robe","rarity":"legendary","lvl":83,"rolledSec":2,"fx":{"trigger":"on chain lightning hit","scope":"lightning","effect":"+8% Lightning damage for 5s, stacking up to 10"},"rolls":[{"s":"will","p":1,"v":15},{"s":"focus","p":1,"v":15},{"s":"vitality","p":1,"v":53}]},
  {"slot":"Chest","name":"Necrotic Warrior Plate","rarity":"legendary","lvl":91,"rolls":[{"s":"power","p":1,"v":17},{"s":"ferocity","p":1,"v":16},{"s":"vitality","p":1,"v":58},{"s":"critical_strike_damage","p":0,"v":41.0},{"s":"attack_speed","p":0,"v":8.5}]},
  {"slot":"Feet","name":"ChronoTehc Boots","rarity":"rare","lvl":47,"rolls":[{"s":"vitality","p":1,"v":29},{"s":"will","p":1,"v":9},{"s":"focus","p":1,"v":9},{"s":"critical_strike_damage","p":0,"v":22.0},{"s":"healing_power","p":0,"v":22.0},{"s":"dot_potency","p":0,"v":22.0}]},
  {"slot":"Feet","name":"Dark Obsidian Legs","rarity":"epic","lvl":64,"rolledSec":3,"rolls":[{"s":"vitality","p":1,"v":40},{"s":"will","p":1,"v":12},{"s":"focus","p":1,"v":12}]},
  /* Observed sample always showed these secondaries — treat as fixed until proven otherwise. */
  {"slot":"Feet","name":"Voltscale Legguards","rarity":"legendary","lvl":47,"rolls":[{"s":"vitality","p":1,"v":29},{"s":"power","p":1,"v":9},{"s":"ferocity","p":1,"v":9},{"s":"critical_strike_chance","p":0,"v":7.0},{"s":"critical_strike_chance","p":0,"v":5.0,"t":"gun"},{"s":"critical_strike_damage","p":0,"v":28.0}]},
  {"slot":"Feet","name":"Foundation Bulwark Greaves","rarity":"legendary","lvl":83,"rolledSec":2,"fx":{"trigger":"on enemy hit","scope":"","effect":"1% chance to heal you for 1 HP"},"rolls":[{"s":"power","p":1,"v":15},{"s":"will","p":1,"v":15},{"s":"vitality","p":1,"v":53}]},
  {"slot":"Feet","name":"Virelda Warcrest Greaves","rarity":"legendary","lvl":83,"rolledSec":2,"fx":{"trigger":"on heavy hit","scope":"","effect":"Large Cooldown Reduction buff for a short duration"},"rolls":[{"s":"power","p":1,"v":15},{"s":"ferocity","p":1,"v":15},{"s":"vitality","p":1,"v":53}]},
  /* The extra projectile is a Legendary bonus roll here, not a fixed line - it was
     transcribed from a copy that happened to roll it. Base secondaries are attack
     speed, heavy hit chance and duration, which the database supplies. */
  {"slot":"Feet","name":"Neotilus Trailseeker Boots","rarity":"legendary","lvl":83,"rolledSec":3,"rolls":[{"s":"power","p":1,"v":15},{"s":"precision","p":1,"v":15},{"s":"vitality","p":1,"v":53}]},
  {"slot":"Feet","name":"Necrotic Warrior Boots","rarity":"legendary","lvl":91,"rolledSec":2,"rolls":[{"s":"power","p":1,"v":17},{"s":"ferocity","p":1,"v":16},{"s":"vitality","p":1,"v":58}]},
  {"slot":"Head","name":"Encoded Helm","rarity":"rare","lvl":28,"rolls":[{"s":"vitality","p":1,"v":14},{"s":"precision","p":1,"v":7},{"s":"will","p":1,"v":7},{"s":"attack_speed","p":0,"v":5.5},{"s":"physical_damage","p":0,"v":5.5},{"s":"knockback","p":0,"v":22.0}]},
  {"slot":"Head","name":"Foundation Bulwark Helm","rarity":"uncommon","lvl":50,"rolls":[{"s":"power","p":1,"v":12},{"s":"will","p":1,"v":12},{"s":"vitality","p":1,"v":26},{"s":"attack_speed","p":0,"v":7.2}]},
  {"slot":"Head","name":"Virelda Warcrest Helm","rarity":"legendary","lvl":50,"rolls":[{"s":"power","p":1,"v":12},{"s":"ferocity","p":1,"v":12},{"s":"vitality","p":1,"v":26},{"s":"attack_speed","p":0,"v":8.0},{"s":"health","p":0,"v":80.0}]},
  {"slot":"Head","name":"Neotilus Trailseeker Visor","rarity":"legendary","lvl":50,"rolledSec":2,"fx":{"trigger":"on enemy kill","scope":"gun","effect":"5% chance to spawn a mini-minigun around you"},"rolls":[{"s":"power","p":1,"v":12},{"s":"precision","p":1,"v":12},{"s":"vitality","p":1,"v":26}]},
  {"slot":"Head","name":"Necrotic Warrior Crown","rarity":"legendary","lvl":54,"rolls":[{"s":"power","p":1,"v":13},{"s":"ferocity","p":1,"v":13},{"s":"vitality","p":1,"v":28},{"s":"attack_speed","p":0,"v":8.8},{"s":"duration","p":0,"v":39.0},{"s":"aoe_radius","p":0,"v":200.0}]},
  {"slot":"Head","name":"Lunar Conduit Crown","rarity":"epic","lvl":54,"rolledSec":3,"fx":{"trigger":"on heavy hit","scope":"pyrosphere","effect":"Fire nova"},"rolls":[{"s":"will","p":1,"v":13},{"s":"focus","p":1,"v":13},{"s":"vitality","p":1,"v":28}]},
  {"slot":"Neck","name":"Gunner's Pendant","rarity":"rare","lvl":0,"rolls":[{"s":"duration","p":0,"v":50.0}]},
  /* Unique line is fixed; legendary rolls 3 more secondaries, epic/rare usually 2. */
  {"slot":"Ring 1","name":"Double Tap Ring","rarity":"legendary","lvl":0,"rolledSec":3,"rolls":[{"s":"shots_per_tick","p":0,"v":100,"t":"gun"}]},
  {"slot":"Ring 1","name":"Pyrosphere Ring","rarity":"legendary","lvl":0,"rolledSec":3,"rolls":[{"s":"projectile_count","p":0,"v":1,"t":"pyrosphere"}]},
  {"slot":"Ring 1","name":"Catalyst Ring","rarity":"legendary","lvl":0,"rolledSec":3,"rolls":[{"s":"dot_interval","p":0,"v":-50.0}]},
  {"slot":"Ring 1","name":"Drone Base Count Ring","rarity":"epic","lvl":0,"rolls":[{"s":"cooldown_reduction","p":0,"v":16.0},{"s":"duration","p":0,"v":16.0},{"s":"knockback","p":0,"v":11.0},{"s":"health","p":0,"v":27.5}]},
  {"slot":"Ring 1","name":"Always Catch Ring","rarity":"epic","lvl":0,"rolls":[{"s":"attack_speed","p":0,"v":16.0},{"s":"physical_damage","p":0,"v":3.0},{"s":"heavy_hit_chance","p":0,"v":3.0}]},
  {"slot":"Ring 1","name":"Kusarigama Ring","rarity":"epic","lvl":0,"rolls":[{"s":"physical_damage","p":0,"v":24.0},{"s":"heavy_hit_chance","p":0,"v":8.0},{"s":"attack_speed","p":0,"v":2.65},{"s":"cooldown_reduction","p":0,"v":1.25}]},
  {"slot":"Ring 1","name":"Ring of Avoidance","rarity":"epic","lvl":0,"rolls":[{"s":"dodge_chance","p":0,"v":10.0},{"s":"cooldown_reduction","p":0,"v":16.0},{"s":"shielding_power","p":0,"v":24.0},{"s":"healing_power","p":0,"v":10.5},{"s":"critical_strike_chance","p":0,"v":2.65}]},
  {"slot":"Ring 1","name":"Ring of Intimidation","rarity":"legendary","lvl":0,"rolls":[{"s":"threat","p":0,"v":1000.0},{"s":"health","p":0,"v":44.0},{"s":"health_regen","p":0,"v":6.0},{"s":"critical_strike_damage","p":0,"v":13.5},{"s":"attack_speed","p":0,"v":3.35},{"s":"cooldown_reduction","p":0,"v":1.75}]},
];
/* Legendary hidden effects. The in-game tooltip shows at most a bare [Tag] line for
   these, so this is the only place they're written down.

   Every row below was read off a real item — the trigger, the scope and the chance
   are the server's own values, not an interpretation of a tooltip.

   TRIGGER CHANCES ARE STALE. Every chance below was measured BEFORE the
   2026-07-28 patch, when nearly all of them read 100%. That patch changed them:
   players report procs no longer firing reliably, and nobody has re-measured the
   new rates yet. The WHICH (item -> effect -> trigger -> scope) still holds,
   because that is structural. The HOW OFTEN does not. Until a fresh reading
   exists, treat every percentage here as "this item procs", not as a rate.

   ONLY RARITY 4 (Legendary) CARRIES A PROC. Zero of the rarities 1-3 observed had
   one. At rarity 4 the effect is a property of the base item and never varies:
   across everything observed, 20 proc-carrying base items and 33 proc-less ones, with no
   base item ever contradicting itself. So "any Legendary t4 Neotilus chest has the
   gun-crit proc" is a safe claim — but a lower-rarity copy of that same item has
   nothing, which is what makes the tooltip so misleading.

   Rarity is not shown anywhere in the item tooltip, which is why the distinction
   between a Legendary and a lower-rarity copy of the same item is so easy to miss.

   Plenty of Legendaries simply have no proc — every accessory observed (rings,
   belts), and e.g. the Necrotic Warrior Boots. A blank is normal, not missing data.

   `id` is the server's ability id, kept verbatim so a row can always be traced back.

   `buffs:true` marks the rows where the tag is known to name what the effect BUFFS,
   because the ability id says so outright (legendary_gun_crit_power_buff_ability
   buffs [gun]). Only those get an "applies to your X" line.

   On the rest the tag describes the effect's own category, not a requirement — the
   t4 heavy is a hammer whose tag reads [bomb_explosion], and a hammer plainly does
   not gate on bomb abilities. Those rows show the tag and let you judge.

   `name` is filled in only where an in-game tooltip was matched to the internal id
   by an exact stat line. Region codes are NOT display names: weapon_t4_heavy_lunar_001
   is the "Dark Yoku Hammer", nothing to do with Lunar. */
const PROCS=[
 {pat:"t4 chest Neotilus", trigger:"on crit", effect:"Power buff to gun abilities", scope:"gun", chance:100, buffs:true, id:"legendary_gun_crit_power_buff_ability", name:"Obsidian Kimono"},
 {pat:"t4 chest Virelda", trigger:"on enemy hit", effect:"Fire burn DEBUFF on the enemy", scope:"physical", chance:100, id:"sword_fire_burn_debuff", name:"Midnight Kimono"},
 {pat:"t4 feet Virelda", trigger:"on enemy hit", effect:"Chill DEBUFF on the enemy", scope:"melee", chance:100, id:"legendary_melee_chill_debuff", name:"Midnight Legwraps"},
 {pat:"t4 head Foundation", trigger:"on heavy hit", effect:"Knockback buff", scope:"", chance:100, buffs:true, id:"legendary_heavy_hit_knockback_buff_ability", name:"Obsidian Visor"},
 {pat:"t4 head Virelda", trigger:"on crit", effect:"Explosion radius buff", scope:"", chance:100, buffs:true, id:"legendary_crit_explosion_radius_buff_ability", name:"Midnight Hair"},
  /* Shares the Voltspore Cleaver's id because both are Winter's Harvest. The
    fortify-and-threat effect is Challenger's Aegis, on the TIER 6 copy. */
 {pat:"t5 chest Foundation", trigger:"on enemy kill", effect:"Power buff to cold abilities", scope:"cold", chance:100, buffs:true, id:"legendary_kill_cold_power_buff_ability", name:"Foundation Bulwark Chestguard"},
 {pat:"t5 chest Lunar", trigger:"on chain lightning hit", effect:"+8% Lightning damage for 5s, stacking up to 10", scope:"lightning", chance:100, buffs:true, id:"legendary_lightning_hit_power_buff_ability", name:"Lunar Conduit Robe"},
 {pat:"t5 chest Neotilus", trigger:"on crit", effect:"Drone buff", scope:"explosive", chance:10, buffs:true, id:"legendary_explosive_crit_drone_buff_ability", name:"Neotilus Trailseeker Coat"},
  /* The wiki calls this Vital Spark, "hits have a small chance to restore health",
    which matches the 1% heal recorded here. Provoker's Edge belongs to the TIER 6
    copy of this item. */
 {pat:"t5 feet Foundation", trigger:"on enemy hit", effect:"Heal 1 HP", scope:"", chance:1, id:"legendary_on_hit_1hp_heal", name:"Foundation Bulwark Greaves"},
  /* Shares the Tritanium Hammer's id because it genuinely shares its effect - the
    wiki calls both Momentum Engine. The iL91 tooltip showing a stacking Physical
    buff is the TIER 6 copy of this item, which is a different record. */
 {pat:"t5 feet Virelda", trigger:"on heavy hit", effect:"Cooldown reduction buff", scope:"", chance:100, buffs:true, id:"legendary_heavy_hit_cdr_buff_ability", name:"Virelda Warcrest Greaves"},
 {pat:"t5 head Foundation", trigger:"on heavy hit", effect:"Knockback buff", scope:"", chance:100, buffs:true, id:"legendary_heavy_hit_knockback_buff_ability", name:"Foundation Bulwark Helm"},
 {pat:"t5 head Lunar", trigger:"on heavy hit", effect:"Fire nova", scope:"pyrosphere", chance:100, id:"firenova", name:"Lunar Conduit Crown"},
 {pat:"t5 head Neotilus", trigger:"on enemy kill", effect:"Spawns a mini minigun", scope:"gun", chance:5, id:"legendary_mini_minigun", name:"Neotilus Trailseeker Visor"},
 {pat:"t5 head Virelda", trigger:"on enemy hit", effect:"Fire burn DEBUFF on the enemy", scope:"physical", chance:100, id:"sword_fire_burn_debuff", name:"Virelda Warcrest Helm"},
 {pat:"t3 heavy Lunar", trigger:"on heavy hit", effect:"Power buff to explosive abilities", scope:"explosive", chance:100, buffs:true, id:"legendary_heavy_hit_explosive_power_buff_ability", name:"Voltlite Axe"},
 {pat:"t3 staff Foundation", trigger:"on crit", effect:"Power buff to void abilities", scope:"void", chance:100, buffs:true, id:"legendary_void_crit_power_buff_ability", name:"Encoded Staff"},
 {pat:"t3 staff Lunar", trigger:"on enemy kill", effect:"Power buff to fire abilities", scope:"fire", chance:100, buffs:true, id:"legendary_kill_fire_power_buff_ability", name:"Voltlite Staff"},
 {pat:"t3 sword Virelda", trigger:"on enemy kill", effect:"Power buff to cold abilities", scope:"cold", chance:100, buffs:true, id:"legendary_kill_cold_power_buff_ability", name:"Voltspore Cleaver"},
 {pat:"t4 heavy Lunar", trigger:"on impact end", effect:"Shockwave after 5 hits", scope:"bomb_explosion", chance:100, id:"legendary_bomb_5hit_shockwave", name:"Dark Yoku Hammer"},
 {pat:"t4 heavy Neotilus", trigger:"on heavy hit", effect:"Cooldown reduction buff", scope:"", chance:100, buffs:true, id:"legendary_heavy_hit_cdr_buff_ability", name:"Tritanium Hammer"},
 {pat:"t4 staff Lunar", trigger:"on crit", effect:"Power buff to void abilities", scope:"void", chance:100, buffs:true, id:"legendary_void_crit_power_buff_ability", name:"Dark Yoku Staff"},
 {pat:"t5 greatsword Neotilus", trigger:"on enemy hit", effect:"Chill DEBUFF on the enemy", scope:"melee", chance:100, id:"legendary_melee_chill_debuff", name:"Viridium Greatsword"},
 {pat:"t5 staff Lunar", trigger:"on impact end", effect:"Shockwave after 5 hits", scope:"pyrosphere", chance:100, id:"legendary_pyrosphere_5hit_shockwave", name:"Viridium Yoku Staff"},
 /* Recorded 2026-07-30. Every effect the tool already held was confirmed
    unchanged, so these are additions rather than corrections. Two of them
    settle a tier question that had been corrected by hand earlier: the
    melee-crit threat proc sits on the TIER 6 greaves and the fortify proc
    on the TIER 6 chestguard. */
 {pat:"t4 feet Foundation", trigger:"on ally hit", effect:"Shielding an ally boosts your shielding power", scope:"fortify", chance:100, id:"legendary_shield_power_buff_ability", name:"Obsidian Cargos"},
 {pat:"t5 chest Virelda", trigger:"on crit", effect:"Heavy hits and critical strikes boost your physical power for a short time", scope:"melee", chance:100, id:"legendary_heavy_hit_physical_power_buff_ability", name:"Virelda Warcrest Cuirass"},
 {pat:"t6 chest Foundation", trigger:"on cast", effect:"Fortifying grants physical power and draws enemy threat", scope:"fortify", chance:100, id:"legendary_fortify_physical_threat_buff_ability", name:"Foundation Bulwark Chestguard"},
 {pat:"t6 chest Virelda", trigger:"on impact end", effect:"Sustained hits launch a spinning chakram at your target", scope:"kusarigama", chance:100, id:"legendary_kusarigama_10hit_spawn_chakram", name:"Virelda Warcrest Cuirass"},
 {pat:"t6 feet Foundation", trigger:"on crit", effect:"Melee critical strikes generate extra threat", scope:"melee", chance:100, id:"legendary_melee_crit_threat_buff_ability", name:"Foundation Bulwark Greaves"},
 {pat:"t6 greatsword Neotilus", trigger:"on cast", effect:"Greatsword swings are followed by a delayed phantom swing", scope:"greatsword", chance:100, id:"legendary_greatsword_delayed_swing", name:"Celestial Greatsword"},
 {pat:"t6 sword Virelda", trigger:"on cast", effect:"Casting has a 10% chance to unleash chain lightning at the nearest enemy", scope:"sword", chance:10, id:"chain_lightning", name:"Redeemed Celestial Katana"},
 {pat:"t6 sword Virelda", trigger:"on enemy hit", effect:"Casting has a 10% chance to unleash chain lightning at the nearest enemy", scope:"chain_lightning", chance:100, id:"legendary_chain_lightning_burst_explosion", name:"Redeemed Celestial Katana"},
 /* Recovered by pairing item_level_with_stats responses with the request
    that names the item -- the response alone carries a bare stats array, which
    is why these were invisible to every earlier pass. They fill in the belts,
    a slot the tool had nothing for, and confirm the community's damage-typed
    belt families exactly. Tier changes a belt's effect like everything else:
    the Emberline buffs fire on a kill at Tier 5 and on an Elemental cast at
    Tier 6. */
 {pat:"t3 necklace Foundation", trigger:"on cast", effect:"Healing Pulse fires an additional pulse", scope:"healing_pulse", chance:0, id:"healing_pulse_additional_pulse", name:"Encoded Marksman's Pendant"},
 {pat:"t4 necklace Foundation", trigger:"on cast", effect:"Periodically taunts nearby enemies", scope:"greatsword", chance:100, id:"legendary_periodic_taunt", name:"Obsidian Blast Pendant"},
 {pat:"t5 belt", trigger:"on enemy kill", effect:"Power buff to fire abilities", scope:"fire", chance:100, id:"legendary_kill_fire_power_buff_4_ability", name:"Emberline Belt"},
 {pat:"t5 belt", trigger:"on crit", effect:"Power buff to cold abilities", scope:"cold", chance:100, id:"legendary_cold_crit_power_buff_ability", name:"Frostline Belt"},
 {pat:"t5 belt", trigger:"on heavy hit", effect:"Power buff to physical abilities", scope:"physical", chance:100, id:"legendary_heavy_hit_physical_power_buff_4_ability", name:"Ironline Belt"},
 {pat:"t5 belt", trigger:"on heavy hit", effect:"Power buff to explosive abilities", scope:"explosive", chance:100, id:"legendary_heavy_hit_explosive_power_buff_4_ability", name:"Blastline Belt"},
 {pat:"t5 necklace Foundation", trigger:"on ally hit", effect:"Shielding an ally buffs your physical resistance", scope:"fortify", chance:100, id:"legendary_shield_physical_resistance_buff_ability", name:"Viridium Blast Pendant"},
 {pat:"t5 necklace Neotilus", trigger:"on expire", effect:"Spawns a phantom Gleam Twins when the buff expires", scope:"gleamtwins", chance:100, id:"legendary_phantom_smg", name:"Viridium Elemental Pendant"},
 {pat:"t6 belt", trigger:"on cast", effect:"Casting an Elemental ability buffs your fire power", scope:"elemental", chance:100, id:"legendary_elemental_cast_fire_buff_ability", name:"Emberline Belt"},
 {pat:"t6 belt", trigger:"on enemy hit", effect:"Chilling or freezing an enemy buffs your cold power", scope:"chill", chance:100, id:"legendary_freeze_cold_buff_ability", name:"Frostline Belt"},
 {pat:"t6 belt", trigger:"on impact end", effect:"Explosive power buff after 5 hits", scope:"explosion", chance:100, id:"legendary_explosion_5hit_explosive_buff_ability", name:"Blastline Belt"},
];
/* Legendaries confirmed to carry NO proc, so a blank can be trusted rather than
   read as "we haven't looked". Every accessory observed at Legendary rarity is in
   here — rings and belts appear never to proc at all. */
const NO_PROC=[
 "t3 feet Foundation","t3 feet Lunar","t3 feet Virelda","t3 head Lunar","t3 head Neotilus",
 "t3 head Virelda","t4 chest Lunar","t5 chest Necro","t5 feet Lunar","t5 feet Necro",
 "t5 feet Neotilus","t5 head Necro","all rings","all belts",
];
/* Items known to exist that this catalogue holds NOTHING for -- not even stats,
   so they cannot live in ITEM_DB and would otherwise be invisible everywhere.

   These eight internal cloak ids are seen in play with nothing recorded for them --
   no name, no stats. They are NOT the named back items the wiki documents (Gecko
   Backpack and the rest, now in the library): those carry no internal id and these
   carry no name, so the two lists have never been joined. Whether these are the
   crafted variants of the named ones is unknown, and worth someone checking. */
const MISSING_ITEMS=[
 {slot:"Back", id:"accessory_t2_cloak_foundation_001", tier:2, set:"Foundation Bulwark"},
 {slot:"Back", id:"accessory_t3_cloak_foundation_001", tier:3, set:"Foundation Bulwark"},
 {slot:"Back", id:"accessory_t4_cloak_foundation_001", tier:4, set:"Foundation Bulwark"},
 {slot:"Back", id:"accessory_t5_cloak_foundation_001", tier:5, set:"Foundation Bulwark"},
 {slot:"Back", id:"accessory_t2_cloak_neotilus_001", tier:2, set:"Neotilus Trailseeker"},
 {slot:"Back", id:"accessory_t3_cloak_neotilus_001", tier:3, set:"Neotilus Trailseeker"},
 {slot:"Back", id:"accessory_t4_cloak_neotilus_001", tier:4, set:"Neotilus Trailseeker"},
 {slot:"Back", id:"accessory_t5_cloak_neotilus_001", tier:5, set:"Neotilus Trailseeker"},
];
/* Observed item database — 102 base items recorded in play.
   p   = primary attributes. FIXED per base item: identical at every rarity, so the
         item level (their sum) is fixed too. This is what identifies an item.
   sec = every secondary seen on it. WHICH ones you get varies by roll; the VALUE is
         set by item level and rarity, not rolled — an iL83 Legendary always shows
         knockback 33. That is why two different items can share a stat line.
   r   = rarities observed (4 = Legendary).  fx = its Legendary proc, if any.
   Absence means not yet observed, never 'does not exist'. */
const ITEM_DB={
 "accessory_t2_belt_001":{"p":{},"lvl":0,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","health","heavy_hit_chance","knockback","power_physical"],"r":[2,3],"fx":null,"d":["table_dungeon_chest_virelda_t1_beacon_001",0.001667],"src":"wiki","bs":{"power_physical":10}},
 "accessory_t2_belt_002":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","duration","power_cold","power_shielding"],"r":[2,3],"fx":null,"d":["table_dungeon_chest_virelda_t1_beacon_001",0.001667],"src":"wiki","bs":{"power_cold":10}},
 "accessory_t2_belt_003":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","duration","power_lightning"],"r":[2,3],"fx":null,"d":["table_dungeon_chest_virelda_t1_beacon_001",0.001667],"src":"wiki","bs":{"power_lightning":10}},
 "accessory_t2_belt_004":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","power_fire"],"r":[2,3],"fx":null,"d":["table_dungeon_chest_virelda_t1_beacon_001",0.001667],"src":"wiki","bs":{"power_fire":10}},
 "accessory_t2_belt_005":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","duration","health_regen","power_ethereal","power_healing","power_shielding"],"r":[2,3],"fx":null,"d":["table_dungeon_chest_virelda_t1_beacon_001",0.001667],"src":"wiki","bs":{"power_ethereal":10}},
 "accessory_t2_belt_006":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_damage","dot_potency","duration","power_healing","power_void"],"r":[2,3],"fx":null,"d":["table_dungeon_chest_virelda_t1_beacon_001",0.001667],"src":"wiki","bs":{"power_void":10}},
 "accessory_t2_neck_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[2,3],"fx":null,"d":["arenaT2MasterTable",0.000311],"src":"wiki","bs":{"critical_strike_chance":2,"aoe_radius":5}},
 "accessory_t3_belt_001":{"p":{},"lvl":0,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","health","heavy_hit_chance","knockback","power_physical"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.001667],"src":"wiki","bs":{"power_physical":15}},
 "accessory_t3_belt_002":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","duration","power_cold","power_shielding"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.001667],"src":"wiki","bs":{"power_cold":15}},
 "accessory_t3_belt_003":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","duration","power_lightning"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.001667],"src":"wiki","bs":{"power_lightning":15}},
 "accessory_t3_belt_004":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","power_fire"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.001667],"src":"wiki","bs":{"power_fire":15}},
 "accessory_t3_belt_005":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","duration","health_regen","power_ethereal","power_healing","power_shielding"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.001667],"src":"wiki","bs":{"power_ethereal":15}},
 "accessory_t3_belt_006":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_damage","dot_potency","duration","power_healing","power_void"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.001667],"src":"wiki","bs":{"power_void":15}},
 "accessory_t3_ring_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dodge_chance","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00125],"src":"wiki","bs":{"cooldown_reduction":16,"dodge_chance":10,"power_shielding":24}},
 "accessory_t3_ring_002":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00125],"src":"wiki","bs":{"cooldown_reduction":12,"dot_potency":24}},
 "accessory_t3_ring_003":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding","threat"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00125],"src":"wiki","bs":{"health":44,"health_regen":6,"threat":1000}},
 "accessory_t3_ring_004":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00125],"src":"wiki","bs":{"attack_speed":24,"duration":16}},
 "accessory_t3_ring_005":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding","projectile_count"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00125],"src":"wiki","bs":{"critical_strike_damage":24,"cooldown_reduction":12,"projectile_count":1}},
 "accessory_t3_ring_006":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding","projectile_count"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00125],"src":"wiki","bs":{"cooldown_reduction":16,"duration":16,"projectile_count":2}},
 "accessory_t3_ring_007":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00125],"src":"wiki","bs":{"heavy_hit_chance":8,"power_physical":24}},
 "accessory_t3_ring_008":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_ethereal","power_healing","power_physical","power_shielding"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00125],"src":"wiki","bs":{"attack_speed":16,"power_ethereal":24}},
 "accessory_t4_belt_001":{"p":{},"lvl":0,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","health","heavy_hit_chance","knockback","power_physical"],"r":[2,3,4],"fx":null,"d":["farpointBeaconT4ChestMasterTable",0.001667],"src":"wiki","bs":{"power_physical":20}},
 "accessory_t4_belt_002":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","duration","power_cold","power_shielding"],"r":[2,3,4],"fx":null,"d":["farpointBeaconT4ChestMasterTable",0.001667],"src":"wiki","bs":{"power_cold":20}},
 "accessory_t4_belt_003":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","duration","power_lightning"],"r":[2,3,4],"fx":null,"d":["farpointBeaconT4ChestMasterTable",0.001667],"src":"wiki","bs":{"power_lightning":20}},
 "accessory_t4_belt_004":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","power_fire"],"r":[2,3,4],"fx":null,"d":["farpointBeaconT4ChestMasterTable",0.001667],"src":"wiki","bs":{"power_fire":20}},
 "accessory_t4_belt_005":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","duration","health_regen","power_ethereal","power_healing","power_shielding"],"r":[2,3,4],"fx":null,"d":["farpointBeaconT4ChestMasterTable",0.001667],"src":"wiki","bs":{"power_ethereal":20}},
 "accessory_t4_belt_006":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_damage","dot_potency","duration","power_healing","power_void"],"r":[2,3,4],"fx":null,"d":["farpointBeaconT4ChestMasterTable",0.001667],"src":"wiki","bs":{"power_void":20}},
 "accessory_t5_belt_001":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration"],"r":[2,3,4],"fx":{"t":"on_enemy_kill","a":"legendary_kill_fire_power_buff_4_ability","s":"fire","c":100,"min":null},"d":["everduneBeaconT5ChestMasterTable",0.001667],"src":"wiki","bs":{"duration":15,"aoe_radius":5.5,"dot_potency":15}},
 "accessory_t5_belt_002":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration"],"r":[2,3,4],"fx":{"t":"on_crit","a":"legendary_cold_crit_power_buff_ability","s":"cold","c":100,"min":null},"d":["everduneBeaconT5ChestMasterTable",0.001667],"src":"wiki","bs":{"duration":15,"aoe_radius":5.5,"dot_potency":15}},
 "accessory_t5_belt_003":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration"],"r":[2,3,4],"fx":{"t":"on_crit","a":"legendary_lightning_hit_power_buff_ability","s":"lightning","c":100,"min":null},"d":["everduneBeaconT5ChestMasterTable",0.001667],"src":"wiki","bs":{"duration":15,"aoe_radius":5.5,"dot_potency":15}},
 "accessory_t5_belt_004":{"p":{},"lvl":0,"sec":["attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[2,3,4],"fx":{"t":"on_heavy_hit","a":"legendary_heavy_hit_physical_power_buff_4_ability","s":"physical","c":100,"min":null},"d":["everduneBeaconT5ChestMasterTable",0.001667],"src":"wiki","bs":{"heavy_hit_chance":5,"knockback":12,"power_physical":5}},
 "accessory_t5_belt_005":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration"],"r":[2,3,4],"fx":{"t":"on_heavy_hit","a":"legendary_heavy_hit_explosive_power_buff_4_ability","s":"explosive","c":100,"min":null},"d":["everduneBeaconT5ChestMasterTable",0.001667],"src":"wiki","bs":{"duration":15,"aoe_radius":5.5,"dot_potency":15}},
 "accessory_t5_belt_006":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","heavy_hit_chance","power_healing"],"r":[2,3,4],"fx":{"t":"on_crit","a":"legendary_void_crit_power_buff_ability","s":"void","c":100,"min":null},"d":["everduneBeaconT5ChestMasterTable",0.001667],"src":"wiki","bs":{"cooldown_reduction":2.25,"aoe_radius":6,"dot_potency":16.5}},
 "accessory_t6_belt_001":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration"],"r":[2,3,4],"fx":{"t":"on_cast","a":"legendary_elemental_cast_fire_buff_ability","s":"elemental","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.001667],"src":"wiki","bs":{"duration":16.5,"aoe_radius":6,"dot_potency":16.5}},
 "accessory_t6_belt_002":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration"],"r":[2,3,4],"fx":{"t":"on_enemy_hit","a":"legendary_freeze_cold_buff_ability","s":"chill","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.001667],"src":"wiki","bs":{"duration":16.5,"aoe_radius":6,"dot_potency":16.5}},
 "accessory_t6_belt_003":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration"],"r":[2,3,4],"fx":{"t":"on_impact_end","a":"legendary_lightning_hit_power_buff_ability","s":"lightning","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.001667],"src":"wiki","bs":{"duration":16.5,"aoe_radius":6,"dot_potency":16.5}},
 "accessory_t6_belt_004":{"p":{},"lvl":0,"sec":["attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[2,3,4],"fx":{"t":"on_crit","a":"legendary_heavy_hit_physical_power_buff_ability","s":"melee","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.001667],"src":"wiki","bs":{"heavy_hit_chance":5.5,"knockback":13,"power_physical":5.5}},
 "accessory_t6_belt_005":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration"],"r":[2,3,4],"fx":{"t":"on_impact_end","a":"legendary_explosion_5hit_explosive_buff_ability","s":"explosion","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.001667],"src":"wiki","bs":{"duration":16.5,"aoe_radius":6,"dot_potency":16.5}},
 "accessory_t6_belt_006":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","heavy_hit_chance","power_healing"],"r":[2,3,4],"fx":{"t":"on_cast","a":"legendary_void_crit_power_buff_ability","s":"blackholebomb","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.001667],"src":"wiki","bs":{"cooldown_reduction":2.5,"aoe_radius":6.5,"dot_potency":18}},
 "armor_t1_chest_001":{"p":{"power":2,"ferocity":2,"vitality":5},"lvl":9,"sec":["aoe_radius","attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance"],"r":[1,2],"fx":null,"d":["table_dungeon_chest_virelda_t1_outskirts_001",0.00519],"bs":{"critical_strike_damage":14},"pk":{"0":2,"1":3,"2":4}},
 "armor_t1_chest_002":{"p":{"will":2,"vitality":5,"focus":2},"lvl":9,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage"],"r":[1,2],"fx":null,"d":["table_dungeon_chest_virelda_t1_outskirts_001",0.00519]},
 "armor_t1_chest_003":{"p":{"power":2,"vitality":5,"focus":2},"lvl":9,"sec":["aoe_radius","attack_speed","critical_strike_damage","heavy_hit_chance"],"r":[1,2],"fx":null,"d":["table_dungeon_chest_virelda_t1_beacon_001",0.003571],"pk":{"0":2,"1":3,"2":4}},
 "armor_t1_feet_001":{"p":{"power":2,"ferocity":2,"vitality":5},"lvl":9,"sec":["aoe_radius","attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance"],"r":[0,1,2],"fx":null,"d":["table_dungeon_chest_virelda_t1_outskirts_001",0.00519],"bs":{"critical_strike_damage":14},"pk":{"0":2,"1":3,"2":4}},
 "armor_t1_feet_002":{"p":{"will":2,"vitality":5,"focus":2},"lvl":9,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage"],"r":[0,1,2],"fx":null,"d":["table_dungeon_chest_virelda_t1_outskirts_001",0.00519]},
 "armor_t1_head_001":{"p":{"power":2,"precision":2,"vitality":2},"lvl":6,"sec":["aoe_radius","attack_speed","critical_strike_damage"],"r":[0,1,2],"fx":null,"d":["table_dungeon_chest_virelda_t1_outskirts_001",0.00519],"pk":{"0":2,"1":3,"2":4}},
 "armor_t1_head_002":{"p":{"precision":2,"will":2,"vitality":2},"lvl":6,"sec":["aoe_radius","attack_speed","critical_strike_damage"],"r":[0,1,2],"fx":null,"d":["table_dungeon_chest_virelda_t1_outskirts_001",0.00519],"bs":{"critical_strike_damage":14},"pk":{"0":2,"1":3,"2":4}},
 "armor_t2_chest_001":{"p":{"power":6,"ferocity":6,"vitality":19},"lvl":31,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[0,1,2,3],"fx":null,"d":["arenaT2MasterTable",0.000311],"src":"wiki","bs":{"heavy_hit_chance":4,"knockback":16},"pk":{"0":2,"1":3,"2":4,"3":5}},
 "armor_t2_chest_002":{"p":{"focus":6,"vitality":19,"will":6},"lvl":31,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration"],"r":[0,1,2,3],"fx":null,"d":["arenaT2MasterTable",0.000311],"src":"wiki","bs":{"critical_strike_chance":4,"critical_strike_damage":16},"pk":{"0":2,"1":3,"2":4,"3":5}},
 "armor_t2_chest_003":{"p":{"power":6,"ferocity":6,"vitality":19},"lvl":31,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[0,1,2,3],"fx":null,"d":["arenaT2MasterTable",0.000311],"src":"wiki","bs":{"heavy_hit_chance":4,"knockback":16},"pk":{"0":2,"1":3,"2":4,"3":5}},
 "armor_t2_feet_001":{"p":{"power":6,"ferocity":6,"vitality":19},"lvl":31,"sec":["heavy_hit_chance","knockback","power_physical"],"r":[3],"fx":null,"d":["arenaT2MasterTable",0.000311],"bs":{"heavy_hit_chance":4,"knockback":16},"pk":{"0":2,"1":3,"2":4,"3":5}},
 "armor_t2_feet_002":{"p":{"focus":8,"vitality":19,"will":4},"lvl":31,"sec":["aoe_radius","cooldown_reduction","duration","health","health_regen","power_healing","power_shielding"],"r":[0,1,2,3],"fx":null,"d":["arenaT2MasterTable",0.000311],"src":"wiki","bs":{"health":45,"health_regen":0.9},"pk":{"0":2,"1":3,"2":4,"3":5}},
 "armor_t2_feet_003":{"p":{"power":3,"precision":9,"vitality":19},"lvl":31,"sec":["critical_strike_chance","critical_strike_damage","knockback","power_physical"],"r":[0,1,2],"fx":null,"d":["arenaT2MasterTable",0.000311],"bs":{"heavy_hit_chance":4,"power_physical":4},"pk":{"0":2,"1":3,"2":4,"3":5}},
 "armor_t2_head_001":{"p":{"power":4,"precision":6,"vitality":10},"lvl":20,"sec":["attack_speed","critical_strike_damage","health","knockback","power_physical"],"r":[0,1,2,3],"fx":null,"d":["arenaT2MasterTable",0.000311],"src":"wiki","bs":{"attack_speed":4,"health":45},"pk":{"0":2,"1":3,"2":4,"3":5}},
 "armor_t2_head_002":{"p":{"precision":4,"will":6,"vitality":10},"lvl":20,"sec":["aoe_radius","dot_potency"],"r":[2],"fx":null,"d":["arenaT2MasterTable",0.000311],"bs":{"dot_potency":16,"power_healing":16},"pk":{"0":2,"1":3,"2":4,"3":5}},
 "armor_t2_head_003":{"p":{"power":4,"precision":6,"vitality":10},"lvl":20,"sec":["attack_speed","critical_strike_damage","health","knockback","power_physical"],"r":[0,1,2,3],"fx":null,"d":["arenaT2MasterTable",0.000311],"src":"wiki","bs":{"attack_speed":4,"health":45},"pk":{"0":2,"1":3,"2":4,"3":5}},
 "armor_t3_chest_foundation_001":{"p":{"will":9,"vitality":29,"focus":9},"lvl":47,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","duration","health","health_regen","power_healing","power_shielding"],"r":[2,3],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"health":55,"power_healing":22,"power_shielding":22},"pk":{"2":3,"3":3,"4":2}},
 "armor_t3_chest_lunar_001":{"p":{"will":9,"vitality":29,"focus":9},"lvl":47,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","power_healing"],"r":[1,2,3],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"critical_strike_damage":22,"dot_potency":22,"power_healing":22},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "armor_t3_chest_neotilus_001":{"p":{"power":9,"ferocity":9,"vitality":29},"lvl":47,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_explosive","power_physical"],"r":[1,2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"critical_strike_chance":5.5,"critical_strike_damage":22,"knockback":22},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "armor_t3_chest_virelda_001":{"p":{"precision":9,"will":9,"vitality":29},"lvl":47,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[1,2,3],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00034]},
 "armor_t3_feet_foundation_001":{"p":{"will":9,"vitality":29,"focus":9},"lvl":47,"sec":["aoe_radius","cooldown_reduction","duration","health","power_healing","power_shielding","resistance_physical"],"r":[1,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"health":55,"power_healing":22,"power_shielding":22},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "armor_t3_feet_lunar_001":{"p":{"will":9,"vitality":29,"focus":9},"lvl":47,"sec":["cooldown_reduction","critical_strike_damage","dot_potency","duration","power_cold","power_healing"],"r":[1,2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"critical_strike_damage":22,"dot_potency":22,"power_healing":22},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "armor_t3_feet_neotilus_001":{"p":{"power":9,"ferocity":9,"vitality":29},"lvl":47,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance","power_physical"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"critical_strike_chance":5.5,"critical_strike_damage":22,"knockback":22},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t3_feet_virelda_001":{"p":{"precision":9,"will":9,"vitality":29},"lvl":47,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[1,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00034]},
 "armor_t3_head_foundation_001":{"p":{"precision":7,"will":7,"vitality":14},"lvl":28,"sec":["attack_speed","critical_strike_damage","knockback","power_physical","power_shielding"],"r":[1,2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"attack_speed":5.5,"knockback":22,"power_physical":5.5},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "armor_t3_head_lunar_001":{"p":{"power":7,"vitality":14,"focus":7},"lvl":28,"sec":["attack_speed","critical_strike_damage","knockback","power_fire","power_physical"],"r":[1,2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"attack_speed":5.5,"knockback":22,"power_physical":5.5},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "armor_t3_head_neotilus_001":{"p":{"power":7,"precision":7,"vitality":14},"lvl":28,"sec":["attack_speed","critical_strike_damage","duration","knockback","power_physical","power_void"],"r":[1,2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"critical_strike_damage":22,"attack_speed":5.5,"power_physical":5.5},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "armor_t3_head_virelda_001":{"p":{"power":7,"will":7,"vitality":14},"lvl":28,"sec":["attack_speed","health","health_regen","knockback","power_shielding"],"r":[2,3,4],"fx":null,"d":["everduneBeaconT3ChestMasterTable",0.00034]},
 "armor_t4_chest_foundation_001":{"p":{"will":12,"vitality":40,"focus":12},"lvl":64,"sec":["aoe_radius","cooldown_reduction","duration","health","power_healing","power_shielding"],"r":[2,3],"fx":{"t":"on_enemy_hit","a":"legendary_on_hit_1hp_heal","s":"","c":1,"min":null},"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"cooldown_reduction":3.5,"power_healing":25,"power_shielding":25},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t4_chest_lunar_001":{"p":{"will":12,"vitality":40,"focus":12},"lvl":64,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","dot_potency","duration"],"r":[2,3,4],"fx":null,"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"cooldown_reduction":3.5,"dot_potency":25,"power_healing":25},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t4_chest_neotilus_001":{"p":{"power":12,"ferocity":12,"vitality":40},"lvl":64,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[2,3,4],"fx":{"t":"on_crit","a":"legendary_gun_crit_power_buff_ability","s":"gun","c":100,"min":null},"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"critical_strike_chance":5.9,"critical_strike_damage":25,"attack_speed":5.9},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t4_chest_virelda_001":{"p":{"precision":12,"will":12,"vitality":40},"lvl":64,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[1,2,3,4],"fx":{"t":"on_enemy_hit","a":"sword_fire_burn_debuff","s":"physical","c":100,"min":null},"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"critical_strike_chance":5.9,"critical_strike_damage":25,"attack_speed":5.9},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t4_feet_foundation_001":{"p":{"will":12,"vitality":40,"focus":12},"lvl":64,"sec":["aoe_radius","cooldown_reduction","duration","health","power_healing"],"r":[2,3],"fx":{"t":"on_ally_hit","a":"legendary_shield_power_buff_ability","s":"fortify","c":100,"min":null},"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"cooldown_reduction":3.5,"power_healing":25,"power_shielding":25},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t4_feet_lunar_001":{"p":{"will":12,"vitality":40,"focus":12},"lvl":64,"sec":["aoe_radius","critical_strike_chance","critical_strike_damage","duration"],"r":[2,3],"fx":null,"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"cooldown_reduction":3.5,"dot_potency":25,"power_healing":25},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "armor_t4_feet_neotilus_001":{"p":{"power":12,"ferocity":12,"vitality":40},"lvl":64,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[2,3],"fx":null,"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"critical_strike_chance":5.9,"critical_strike_damage":25,"attack_speed":5.9},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "armor_t4_feet_virelda_001":{"p":{"precision":12,"will":12,"vitality":40},"lvl":64,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[2,3,4],"fx":{"t":"on_enemy_hit","a":"legendary_melee_chill_debuff","s":"melee","c":100,"min":null},"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"critical_strike_chance":5.9,"critical_strike_damage":25,"attack_speed":5.9},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t4_head_foundation_001":{"p":{"power":9,"precision":10,"vitality":20},"lvl":39,"sec":["attack_speed","critical_strike_damage","duration","knockback","power_physical"],"r":[3,4],"fx":{"t":"on_heavy_hit","a":"legendary_heavy_hit_knockback_buff_ability","s":"","c":100,"min":null},"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"attack_speed":5.9,"duration":25,"power_physical":7.4},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t4_head_lunar_001":{"p":{"power":10,"precision":9,"vitality":20},"lvl":39,"sec":["attack_speed","critical_strike_damage","duration","freeze_chance","knockback","power_physical"],"r":[2,3,4],"fx":null,"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"attack_speed":5.9,"duration":25,"power_physical":7.4},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "armor_t4_head_neotilus_001":{"p":{"power":10,"precision":9,"vitality":20},"lvl":39,"sec":["attack_speed","critical_strike_damage","duration","knockback","power_physical"],"r":[1,2,3],"fx":{"t":"on_impact_end","a":"legendary_lightning_hit_power_buff_ability","s":"lightning","c":100,"min":null},"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"attack_speed":5.9,"duration":25,"power_physical":7.4},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t4_head_virelda_001":{"p":{"power":10,"precision":9,"vitality":20},"lvl":39,"sec":["attack_speed","critical_strike_damage","duration","knockback","power_physical"],"r":[2,3,4],"fx":{"t":"on_crit","a":"legendary_crit_explosion_radius_buff_ability","s":"","c":100,"min":null},"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"attack_speed":5.9,"duration":25,"power_physical":7.4},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t5_chest_foundation_001":{"p":{"power":15,"will":15,"vitality":53},"lvl":83,"sec":["critical_strike_chance","health","health_regen","heavy_hit_chance","knockback","power_shielding"],"r":[3,4],"fx":{"t":"on_enemy_kill","a":"legendary_kill_cold_power_buff_ability","s":"cold","c":100,"min":null},"d":["farpointBeaconT5ChestMasterTable",0.000694],"bs":{"critical_strike_chance":7,"attack_speed":8,"heavy_hit_chance":10},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t5_chest_lunar_001":{"p":{"will":15,"vitality":53,"focus":15},"lvl":83,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","power_healing"],"r":[3,4],"fx":{"t":"on_enemy_hit","a":"legendary_lightning_hit_power_buff_ability","s":"chain_lightning","c":100,"min":null},"d":["farpointBeaconT5ChestMasterTable",0.000694],"bs":{"cooldown_reduction":4.5,"aoe_radius":12,"dot_potency":33},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t5_chest_necro_001":{"p":{"power":17,"ferocity":16,"vitality":58},"lvl":91,"sec":["attack_speed","critical_strike_damage","duration","knockback","power_physical"],"r":[4],"fx":null,"d":["farpointBeaconT5ChestMasterTable",0.002778]},
 "armor_t5_chest_neotilus_001":{"p":{"power":15,"precision":15,"vitality":53},"lvl":83,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","duration","heavy_hit_chance","knockback","power_physical"],"r":[3,4],"fx":{"t":"on_crit","a":"legendary_explosive_crit_drone_buff_ability","s":"explosive","c":10,"min":null},"d":["farpointBeaconT5ChestMasterTable",0.000694],"bs":{"attack_speed":8,"heavy_hit_chance":10,"duration":30},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t5_chest_virelda_001":{"p":{"power":15,"ferocity":15,"vitality":53},"lvl":83,"sec":["attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[1,2,3,4],"fx":{"t":"on_crit","a":"legendary_heavy_hit_physical_power_buff_ability","s":"melee","c":100,"min":null},"d":["farpointBeaconT5ChestMasterTable",0.000694],"src":"wiki","bs":{"heavy_hit_chance":10,"knockback":24,"power_physical":10},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t5_feet_foundation_001":{"p":{"power":15,"will":15,"vitality":53},"lvl":83,"sec":["attack_speed","critical_strike_chance","heavy_hit_chance","knockback"],"r":[2,3,4],"fx":{"t":"on_enemy_hit","a":"legendary_on_hit_1hp_heal","s":"","c":1,"min":null},"d":["farpointBeaconT5ChestMasterTable",0.000694],"bs":{"critical_strike_chance":7,"attack_speed":8,"heavy_hit_chance":10},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t5_feet_lunar_001":{"p":{"will":15,"vitality":53,"focus":15},"lvl":83,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration"],"r":[3,4],"fx":null,"d":["farpointBeaconT5ChestMasterTable",0.000694],"bs":{"cooldown_reduction":4.5,"aoe_radius":12,"dot_potency":33},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t5_feet_necro_001":{"p":{"power":17,"ferocity":16,"vitality":58},"lvl":91,"sec":["attack_speed","critical_strike_damage","duration","knockback","power_physical"],"r":[4],"fx":null,"d":["farpointBeaconT5ChestMasterTable",0.002778]},
 "armor_t5_feet_neotilus_001":{"p":{"power":15,"precision":15,"vitality":53},"lvl":83,"sec":["critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical","projectile_count"],"r":[2,3,4],"fx":null,"d":["farpointBeaconT5ChestMasterTable",0.000694],"bs":{"attack_speed":8,"heavy_hit_chance":10,"duration":30},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "armor_t5_feet_virelda_001":{"p":{"power":15,"ferocity":15,"vitality":53},"lvl":83,"sec":["attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[2,4],"fx":{"t":"on_heavy_hit","a":"legendary_heavy_hit_cdr_buff_ability","s":"","c":100,"min":null},"d":["farpointBeaconT5ChestMasterTable",0.000694],"bs":{"heavy_hit_chance":10,"knockback":24,"power_physical":10},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t5_head_foundation_001":{"p":{"power":12,"will":12,"vitality":26},"lvl":50,"sec":["attack_speed","health","health_regen","knockback","power_shielding"],"r":[2,3,4],"fx":{"t":"on_heavy_hit","a":"legendary_heavy_hit_knockback_buff_ability","s":"","c":100,"min":null},"d":["farpointBeaconT5ChestMasterTable",0.000694],"bs":{"health":70,"health_regen":1.4,"power_shielding":24},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t5_head_lunar_001":{"p":{"will":12,"vitality":26,"focus":12},"lvl":50,"sec":["aoe_radius","critical_strike_damage","dot_potency","duration","power_healing"],"r":[3,4],"fx":{"t":"on_heavy_hit","a":"firenova","s":"pyrosphere","c":100,"min":null},"d":["farpointBeaconT5ChestMasterTable",0.000694],"bs":{"duration":24,"aoe_radius":9,"power_healing":24},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t5_head_necro_001":{"p":{"power":13,"ferocity":13,"vitality":28},"lvl":54,"sec":["aoe_radius","attack_speed","critical_strike_damage","duration","knockback","power_physical"],"r":[4],"fx":null,"d":["farpointBeaconT5ChestMasterTable",0.002778]},
 "armor_t5_head_neotilus_001":{"p":{"power":12,"precision":12,"vitality":26},"lvl":50,"sec":["attack_speed","critical_strike_damage","duration","knockback","power_physical"],"r":[3,4],"fx":{"t":"on_enemy_kill","a":"legendary_mini_minigun","s":"gun","c":5,"min":null},"d":["farpointBeaconT5ChestMasterTable",0.000694],"bs":{"knockback":24,"duration":24,"power_physical":9},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t5_head_virelda_001":{"p":{"power":12,"ferocity":12,"vitality":26},"lvl":50,"sec":["attack_speed","critical_strike_damage","health","knockback","power_physical"],"r":[2,3,4],"fx":{"t":"on_enemy_hit","a":"sword_fire_burn_debuff","s":"physical","c":100,"min":null},"d":["farpointBeaconT5ChestMasterTable",0.000694],"bs":{"critical_strike_damage":30,"attack_speed":8,"knockback":24},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "armor_t6_chest_foundation_001":{"p":{"power":17,"vitality":58,"will":16},"lvl":91,"sec":["attack_speed","critical_strike_chance","health","health_regen","heavy_hit_chance","knockback","power_shielding"],"r":[2,3,4],"fx":{"t":"on_cast","a":"legendary_fortify_physical_threat_buff_ability","s":"fortify","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"critical_strike_chance":7.7,"attack_speed":8.8,"heavy_hit_chance":11},"pk":{"2":2,"3":3,"4":2}},
 "armor_t6_chest_lunar_001":{"p":{"focus":16,"vitality":58,"will":17},"lvl":91,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","heavy_hit_chance","power_healing"],"r":[2,3,4],"fx":{"t":"on_heavy_hit","a":"firenova","s":"pyrosphere","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"cooldown_reduction":5,"aoe_radius":13,"dot_potency":36},"pk":{"2":2,"3":3,"4":2}},
 "armor_t6_chest_neotilus_001":{"p":{"power":17,"precision":16,"vitality":58},"lvl":91,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","duration","heavy_hit_chance","knockback","power_physical"],"r":[2,3,4],"fx":{"t":"on_crit","a":"legendary_explosive_crit_drone_buff_ability","s":"explosive","c":10,"min":null},"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"attack_speed":8.8,"heavy_hit_chance":11,"duration":33},"pk":{"2":2,"3":3,"4":2}},
 "armor_t6_chest_virelda_001":{"p":{"power":17,"ferocity":16,"vitality":58},"lvl":91,"sec":["attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[2,3,4],"fx":{"t":"on_impact_end","a":"legendary_kusarigama_10hit_spawn_chakram","s":"kusarigama","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"heavy_hit_chance":11,"knockback":26,"power_physical":11},"pk":{"2":2,"3":3,"4":2}},
 "armor_t6_feet_foundation_001":{"p":{"power":17,"vitality":58,"will":16},"lvl":91,"sec":["attack_speed","critical_strike_chance","health","health_regen","heavy_hit_chance","knockback","power_shielding"],"r":[2,3,4],"fx":{"t":"on_crit","a":"legendary_melee_crit_threat_buff_ability","s":"melee","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"critical_strike_chance":7.7,"attack_speed":8.8,"heavy_hit_chance":11},"pk":{"2":2,"3":3,"4":2}},
 "armor_t6_feet_lunar_001":{"p":{"focus":16,"vitality":58,"will":17},"lvl":91,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","heavy_hit_chance","power_healing"],"r":[2,3,4],"fx":{"t":"on_impact_end","a":"legendary_bomb_5hit_shockwave","s":"bomb_explosion","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"cooldown_reduction":5,"aoe_radius":13,"dot_potency":36},"pk":{"2":2,"3":3,"4":2}},
 "armor_t6_feet_neotilus_001":{"p":{"power":17,"precision":16,"vitality":58},"lvl":91,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","duration","heavy_hit_chance","knockback","power_physical"],"r":[2,3,4],"fx":{"t":"on_crit","a":"legendary_crit_explosion_radius_buff_ability","s":"","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"attack_speed":8.8,"heavy_hit_chance":11,"duration":33},"pk":{"2":2,"3":3,"4":2}},
 "armor_t6_feet_virelda_001":{"p":{"power":17,"ferocity":16,"vitality":58},"lvl":91,"sec":["attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[2,3,4],"fx":{"t":"on_heavy_hit","a":"legendary_heavy_hit_physical_power_buff_ability","s":"physical","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"heavy_hit_chance":11,"knockback":26,"power_physical":11},"pk":{"2":2,"3":3,"4":2}},
 "armor_t6_head_foundation_001":{"p":{"power":13,"vitality":28,"will":13},"lvl":54,"sec":["attack_speed","health","health_regen","knockback","power_shielding"],"r":[2,3,4],"fx":{"t":"on_heavy_hit","a":"legendary_heavy_hit_knockback_buff_ability","s":"","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"health":75,"health_regen":1.5,"power_shielding":26},"pk":{"2":2,"3":3,"4":2}},
 "armor_t6_head_lunar_001":{"p":{"focus":13,"vitality":28,"will":13},"lvl":54,"sec":["aoe_radius","critical_strike_damage","dot_potency","duration","power_healing"],"r":[2,3,4],"fx":null,"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"duration":26,"aoe_radius":9,"power_healing":26},"pk":{"2":2,"3":3,"4":2}},
 "armor_t6_head_neotilus_001":{"p":{"power":13,"precision":13,"vitality":28},"lvl":54,"sec":["attack_speed","critical_strike_damage","duration","knockback","power_physical"],"r":[2,3,4],"fx":{"t":"on_enemy_kill","a":"legendary_mini_minigun","s":"gun","c":5,"min":null},"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"knockback":26,"duration":26,"power_physical":10},"pk":{"2":2,"3":3,"4":2}},
 "armor_t6_head_virelda_001":{"p":{"power":13,"ferocity":13,"vitality":28},"lvl":54,"sec":["attack_speed","critical_strike_damage","health","knockback","power_physical"],"r":[2,3,4],"fx":{"t":"on_enemy_hit","a":"sword_fire_burn_debuff","s":"physical","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"critical_strike_damage":33,"attack_speed":8.8,"knockback":26},"pk":{"2":2,"3":3,"4":2}},
 "weapon_t1_greatsword_001":{"p":{"power":2,"precision":2,"ferocity":2},"lvl":6,"sec":["critical_strike_chance","critical_strike_damage"],"r":[2],"fx":null,"d":["table_dungeon_chest_virelda_t1_outskirts_001",0.00519],"bs":{"critical_strike_damage":13},"pk":{"0":2,"1":3,"2":4}},
 "weapon_t1_greatsword_002":{"p":{"power":2,"will":2,"ferocity":2},"lvl":6,"sec":["attack_speed","critical_strike_damage","heavy_hit_chance"],"r":[2],"fx":null,"d":["table_dungeon_chest_virelda_t1_outskirts_001",0.00519],"bs":{"critical_strike_damage":13},"pk":{"0":2,"1":3,"2":4}},
 "weapon_t1_heavy_001":{"p":{"power":2,"will":2,"focus":2},"lvl":6,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage"],"r":[2],"fx":null,"d":["table_dungeon_chest_virelda_t1_outskirts_001",0.00519],"bs":{"critical_strike_damage":13},"pk":{"0":2,"1":3,"2":4}},
 "weapon_t1_heavy_002":{"p":{"power":2,"precision":2,"focus":2},"lvl":6,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance"],"r":[1,2],"fx":null,"d":["table_dungeon_chest_virelda_t1_outskirts_001",0.00519],"bs":{"critical_strike_damage":13},"pk":{"0":2,"1":3,"2":4}},
 "weapon_t1_staff_001":{"p":{"will":2,"ferocity":2,"focus":2},"lvl":6,"sec":["aoe_radius","critical_strike_damage"],"r":[1,2],"fx":null,"d":["table_dungeon_chest_virelda_t1_outskirts_001",0.00519],"bs":{"aoe_radius":3},"pk":{"0":2,"1":3,"2":4}},
 "weapon_t1_sword_001":{"p":{"power":2,"precision":2,"will":2},"lvl":6,"sec":["aoe_radius","attack_speed","critical_strike_damage"],"r":[1,2],"fx":null,"d":["table_dungeon_chest_virelda_t1_outskirts_001",0.00519],"bs":{"critical_strike_chance":5},"pk":{"0":2,"1":3,"2":4}},
 "weapon_t1_sword_002":{"p":{"power":2,"ferocity":2,"focus":2},"lvl":6,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance"],"r":[2],"fx":null,"d":["table_dungeon_chest_virelda_t1_outskirts_001",0.00519],"bs":{"critical_strike_chance":5},"pk":{"0":2,"1":3,"2":4}},
 "weapon_t2_greatsword_001":{"p":{"power":10,"ferocity":4},"lvl":14,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[0,1,2,3],"fx":null,"d":["arenaT2MasterTable",0.000311],"src":"wiki","bs":{"critical_strike_damage":20,"power_physical":8},"pk":{"0":2,"1":3,"2":4,"3":5}},
 "weapon_t2_heavy_001":{"p":{"power":4,"ferocity":10},"lvl":14,"sec":["attack_speed","critical_strike_damage","health","health_regen","heavy_hit_chance","knockback","power_physical","power_shielding"],"r":[0,1,2,3],"fx":null,"d":["arenaT2MasterTable",0.000311],"src":"wiki","bs":{"critical_strike_damage":20,"power_physical":8},"pk":{"0":2,"1":3,"2":4,"3":5}},
 "weapon_t2_staff_001":{"p":{"precision":4,"will":6,"focus":4},"lvl":14,"sec":["aoe_radius"],"r":[1],"fx":null,"d":["arenaT2MasterTable",0.000311],"bs":{"critical_strike_damage":20,"aoe_radius":8},"pk":{"0":2,"1":3,"2":4,"3":5}},
 "weapon_t2_sword_001":{"p":{"power":6,"precision":4,"will":4},"lvl":14,"sec":["heavy_hit_chance","power_physical"],"r":[2],"fx":null,"d":["arenaT2MasterTable",0.000311],"bs":{"critical_strike_chance":8,"attack_speed":8},"pk":{"0":2,"1":3,"2":4,"3":5}},
 "weapon_t3_greatsword_neotilus_001":{"p":{"power":7,"precision":8,"ferocity":7},"lvl":22,"sec":["critical_strike_chance","duration","heavy_hit_chance","knockback","power_physical"],"r":[2,3],"fx":{"t":"on_heavy_hit","a":"legendary_heavy_hit_physical_power_buff_ability","s":"physical","c":100,"min":null},"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"heavy_hit_chance":14,"power_physical":14},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t3_greatsword_virelda_001":{"p":{"power":7,"will":8,"ferocity":7},"lvl":22,"sec":["health","health_regen","heavy_hit_chance","knockback"],"r":[1,2],"fx":{"t":"on_crit","a":"legendary_heavy_hit_physical_power_buff_ability","s":"melee","c":100,"min":null},"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"critical_strike_damage":24,"heavy_hit_chance":13},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t3_heavy_lunar_001":{"p":{"power":7,"will":8,"focus":7},"lvl":22,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration"],"r":[2,3,4],"fx":{"t":"on_heavy_hit","a":"legendary_heavy_hit_explosive_power_buff_ability","s":"explosive","c":100,"min":null},"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"critical_strike_damage":25,"power_physical":15},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t3_heavy_neotilus_001":{"p":{"power":7,"precision":8,"focus":7},"lvl":22,"sec":["attack_speed","critical_strike_damage","power_physical"],"r":[2,3],"fx":{"t":"on_heavy_hit","a":"legendary_heavy_hit_knockback_buff_ability","s":"","c":100,"min":null},"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"heavy_hit_chance":14,"power_physical":14},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t3_staff_foundation_001":{"p":{"precision":8,"will":7,"focus":7},"lvl":22,"sec":["aoe_radius","duration","health","power_healing","power_shielding"],"r":[1,2,3,4],"fx":{"t":"on_crit","a":"legendary_void_crit_power_buff_ability","s":"void","c":100,"min":null},"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"power_healing":22,"power_shielding":22},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t3_staff_lunar_001":{"p":{"will":7,"ferocity":8,"focus":7},"lvl":22,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","power_healing"],"r":[2,3,4],"fx":{"t":"on_enemy_kill","a":"legendary_kill_fire_power_buff_ability","s":"fire","c":100,"min":null},"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"cooldown_reduction":3,"dot_potency":22},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t3_sword_foundation_001":{"p":{"power":7,"precision":8,"will":7},"lvl":22,"sec":["attack_speed","health","health_regen","power_shielding"],"r":[2,3],"fx":{"t":"on_crit","a":"legendary_lightning_hit_power_buff_ability","s":"lightning","c":100,"min":null},"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"critical_strike_chance":10,"attack_speed":10},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t3_sword_virelda_001":{"p":{"power":7,"ferocity":8,"focus":7},"lvl":22,"sec":["critical_strike_chance","critical_strike_damage","knockback"],"r":[2,3,4],"fx":{"t":"on_enemy_kill","a":"legendary_kill_cold_power_buff_ability","s":"cold","c":100,"min":null},"d":["everduneBeaconT3ChestMasterTable",0.00034],"bs":{"critical_strike_damage":25,"attack_speed":9},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t4_greatsword_neotilus_001":{"p":{"power":10,"precision":10,"ferocity":9},"lvl":29,"sec":["critical_strike_chance","critical_strike_damage","knockback"],"r":[3],"fx":{"t":"on_crit","a":"legendary_melee_crit_threat_buff_ability","s":"melee","c":100,"min":null},"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"critical_strike_damage":31,"power_physical":15},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t4_greatsword_virelda_001":{"p":{"power":10,"will":10,"ferocity":9},"lvl":29,"sec":["heavy_hit_chance"],"r":[1],"fx":{"t":"on_heavy_hit","a":"legendary_heavy_hit_physical_power_buff_ability","s":"physical","c":100,"min":null},"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"heavy_hit_chance":16,"power_physical":16},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t4_heavy_lunar_001":{"p":{"power":10,"will":10,"focus":9},"lvl":29,"sec":["attack_speed","health","health_regen","heavy_hit_chance","knockback","power_shielding"],"r":[3,4],"fx":{"t":"on_impact_end","a":"legendary_bomb_5hit_shockwave","s":"bomb_explosion","c":100,"min":5},"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"critical_strike_damage":31,"power_physical":15},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t4_heavy_neotilus_001":{"p":{"power":10,"precision":10,"focus":9},"lvl":29,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[2,3,4],"fx":{"t":"on_heavy_hit","a":"legendary_heavy_hit_cdr_buff_ability","s":"","c":100,"min":null},"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"heavy_hit_chance":16,"power_physical":16},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t4_staff_foundation_001":{"p":{"precision":10,"will":10,"focus":9},"lvl":29,"sec":["aoe_radius","cooldown_reduction","duration","health"],"r":[2,3],"fx":null,"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"power_healing":25,"power_shielding":25},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "weapon_t4_staff_lunar_001":{"p":{"will":10,"ferocity":10,"focus":9},"lvl":29,"sec":["aoe_radius","cooldown_reduction","dot_potency","power_healing"],"r":[3,4],"fx":{"t":"on_crit","a":"legendary_void_crit_power_buff_ability","s":"void","c":100,"min":null},"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"cooldown_reduction":3.5,"dot_potency":25},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t4_sword_foundation_001":{"p":{"power":10,"precision":10,"will":9},"lvl":29,"sec":["health","health_regen","knockback","trigger_ability_chance"],"r":[3,4],"fx":null,"d":["farpointBeaconT4ChestMasterTable",0.000312],"bs":{"critical_strike_chance":12,"attack_speed":14},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "weapon_t4_sword_virelda_001":{"p":{"power":10,"precision":10,"will":10},"lvl":30,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical","trigger_ability_chance"],"r":[1,2,3,4],"fx":null,"d":["farpointBeaconT4ChestMasterTable",0.000312],"src":"wiki","bs":{"critical_strike_damage":31,"attack_speed":13},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "weapon_t5_greatsword_neotilus_001":{"p":{"power":12,"will":12,"ferocity":12},"lvl":36,"sec":["health","power_shielding"],"r":[4],"fx":{"t":"on_enemy_hit","a":"legendary_melee_chill_debuff","s":"melee","c":100,"min":null},"d":["farpointBeaconT5ChestMasterTable",0.000694],"bs":{"critical_strike_damage":36,"power_physical":16},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t5_heavy_lunar_001":{"p":{"power":12,"will":12,"focus":12},"lvl":36,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency"],"r":[3],"fx":{"t":"on_crit","a":"legendary_melee_crit_threat_buff_ability","s":"melee","c":100,"min":null},"d":["farpointBeaconT5ChestMasterTable",0.000694],"bs":{"critical_strike_damage":42,"attack_speed":8.8},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t5_staff_lunar_001":{"p":{"will":12,"ferocity":12,"focus":12},"lvl":36,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","dot_potency","duration","heavy_hit_chance","power_healing"],"r":[2,3,4],"fx":{"t":"on_impact_end","a":"legendary_pyrosphere_5hit_shockwave","s":"pyrosphere","c":100,"min":5},"d":["farpointBeaconT5ChestMasterTable",0.000694],"bs":{"aoe_radius":15,"dot_potency":41},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t5_sword_virelda_001":{"p":{"power":12,"ferocity":12,"focus":12},"lvl":36,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical","trigger_ability_chance"],"r":[2,3,4],"fx":null,"d":["farpointBeaconT5ChestMasterTable",0.000694],"bs":{"critical_strike_damage":42,"attack_speed":8.8},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "weapon_t6_greatsword_neotilus_001":{"p":{"power":17,"focus":16,"ferocity":16},"lvl":49,"sec":["aoe_radius","cooldown_reduction","critical_strike_damage","duration","health","health_regen","power_healing","power_physical","power_shielding"],"r":[2,3,4],"fx":{"t":"on_cast","a":"legendary_greatsword_delayed_swing","s":"greatsword","c":100,"min":null},"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"critical_strike_damage":47,"power_physical":17},"pk":{"2":2,"3":3,"4":2}},
 "weapon_t6_heavy_lunar_001":{"p":{"power":17,"focus":16,"ferocity":16},"lvl":49,"sec":["aoe_radius","cooldown_reduction","critical_strike_damage","duration","health","health_regen","power_healing","power_physical","power_shielding"],"r":[2,3,4],"fx":null,"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"critical_strike_damage":41,"power_physical":20},"pk":{"2":2,"3":3}},
 "weapon_t6_staff_lunar_001":{"p":{"precision":12,"focus":16,"will":17},"lvl":45,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","heavy_hit_chance","link_count","power_healing"],"r":[2,3,4],"fx":null,"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"cooldown_reduction":5,"dot_potency":41},"pk":{"2":2,"3":3,"4":3}},
 "weapon_t6_sword_virelda_001":{"p":{"power":17,"focus":16,"ferocity":16},"lvl":49,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","duration","heavy_hit_chance","knockback","power_physical"],"r":[2,3,4],"fx":{"t":"on_cast","a":"chain_lightning","s":"sword","c":10,"min":null},"d":["desertBeaconT6ChestMasterTable",0.000691],"src":"wiki","bs":{"critical_strike_chance":8.8,"critical_strike_damage":42},"pk":{"2":2,"3":3,"4":2}},
 "accessory_t2_necklace_001":{"p":{},"lvl":0,"sec":["aoe_radius","cooldown_reduction"],"r":[],"fx":null,"d":null,"src":"wiki","bs":{"cooldown_reduction":8,"aoe_radius":30}},
 "accessory_t2_necklace_002":{"p":{},"lvl":0,"sec":["duration"],"r":[],"fx":null,"d":null,"src":"wiki","bs":{"duration":12}},
 "accessory_t2_necklace_003":{"p":{},"lvl":0,"sec":["critical_strike_chance","critical_strike_damage"],"r":[],"fx":null,"d":null,"src":"wiki","bs":{"critical_strike_chance":15,"critical_strike_damage":16}},
 "accessory_t2_necklace_004":{"p":{},"lvl":0,"sec":["power_physical","resistance_stun"],"r":[],"fx":null,"d":null,"src":"wiki","bs":{"power_physical":12,"resistance_stun":50}},
 "accessory_t3_necklace_foundation_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[2,3,4],"fx":{"t":"on_cast","a":"healing_pulse_additional_pulse","s":"healing_pulse","c":null,"min":null},"d":null,"src":"wiki","bs":{"attack_speed":12,"duration":24}},
 "accessory_t3_necklace_lunar_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","link_count","power_healing","power_physical","power_shielding"],"r":[2,3,4],"fx":null,"d":null,"src":"wiki","bs":{"cooldown_reduction":1.75,"dot_potency":13,"link_count":2}},
 "accessory_t3_necklace_neotilus_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding","projectile_count"],"r":[2,3,4],"fx":null,"d":null,"src":"wiki","bs":{"critical_strike_damage":10.5,"attack_speed":2.65,"projectile_count":1}},
 "accessory_t3_necklace_virelda_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[2,3,4],"fx":null,"d":null,"src":"wiki","bs":{"attack_speed":2.65,"cooldown_reduction":1.25,"duration":50}},
 "accessory_t4_necklace_foundation_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[2,3,4],"fx":{"t":"on_cast","a":"legendary_periodic_taunt","s":"greatsword","c":100,"min":null},"d":null,"src":"wiki","bs":{"health":32.5,"health_regen":0.65}},
 "accessory_t4_necklace_lunar_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[2,3,4],"fx":{"t":"on_cast","a":"legendary_pyrosphere_5hit_shockwave","s":"pyrosphere","c":50,"min":null},"d":null,"src":"wiki","bs":{"duration":12,"aoe_radius":3.5}},
 "accessory_t4_necklace_neotilus_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding","projectile_count"],"r":[2,3,4],"fx":null,"d":null,"src":"wiki","bs":{"critical_strike_damage":12,"attack_speed":2.8,"projectile_count":1}},
 "accessory_t4_necklace_virelda_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[2,3,4],"fx":{"t":"on_impact_end","a":"legendary_kusarigama_10hit_spawn_chakram","s":"kusarigama","c":100,"min":null},"d":null,"src":"wiki","bs":{"critical_strike_damage":12,"attack_speed":2.8}},
 "accessory_t5_necklace_foundation_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[3,4],"fx":{"t":"on_ally_hit","a":"legendary_shield_physical_resistance_buff_ability","s":"fortify","c":100,"min":null},"d":null,"src":"wiki","bs":{"cooldown_reduction":2.5,"health":40,"power_healing":15}},
 "accessory_t5_necklace_lunar_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","link_count","power_healing","power_physical","power_shielding"],"r":[3,4],"fx":null,"d":null,"src":"wiki","bs":{"cooldown_reduction":2.5,"health":40,"link_count":8,"power_healing":15}},
 "accessory_t5_necklace_neotilus_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[3,4],"fx":{"t":"on_expire","a":"legendary_phantom_smg","s":"gleamtwins","c":100,"min":null},"d":null,"src":"wiki","bs":{"attack_speed":4,"heavy_hit_chance":5,"duration":15}},
 "accessory_t5_necklace_virelda_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[3,4],"fx":null,"d":null,"src":"wiki","bs":{"critical_strike_chance":4,"cooldown_reduction":-25,"aoe_radius":7,"power_physical":5}},
 "accessory_t6_necklace_foundation_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[3,4],"fx":null,"d":null,"src":"wiki","bs":{"cooldown_reduction":2.5,"health":40,"power_healing":15}},
 "accessory_t6_necklace_lunar_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding","trigger_ability_chance"],"r":[3,4],"fx":null,"d":null,"src":"wiki","bs":{"cooldown_reduction":2.5,"health":40,"trigger_ability_chance":10,"power_healing":15}},
 "accessory_t6_necklace_neotilus_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[3,4],"fx":null,"d":null,"src":"wiki","bs":{"attack_speed":4,"heavy_hit_chance":5,"duration":15}},
 "accessory_t6_necklace_virelda_001":{"p":{},"lvl":0,"sec":["aoe_radius","attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","health","health_regen","heavy_hit_chance","knockback","power_healing","power_physical","power_shielding"],"r":[3,4],"fx":null,"d":null,"src":"wiki","bs":{"attack_speed":12,"heavy_hit_chance":0.25,"power_physical":18}},
 "armor_t2_feet_004":{"p":{"focus":6,"vitality":14,"will":5},"lvl":25,"sec":["attack_speed","heavy_hit_chance"],"r":[],"fx":null,"d":null,"src":"wiki","bs":{"attack_speed":10,"heavy_hit_chance":5}},
 "armor_t2_head_004":{"p":{"power":4,"precision":2,"will":3},"lvl":9,"sec":["cooldown_reduction","critical_strike_chance"],"r":[],"fx":null,"d":null,"src":"wiki","bs":{"critical_strike_chance":3,"cooldown_reduction":10}},
 "weapon_t5_greatsword_virelda_001":{"p":{"power":17,"ferocity":16,"vitality":58},"lvl":91,"sec":["attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[1,2,3,4],"fx":null,"d":null,"src":"wiki","bs":{"critical_strike_damage":42,"attack_speed":8.8},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t5_heavy_neotilus_001":{"p":{"power":17,"ferocity":16,"vitality":58},"lvl":91,"sec":["attack_speed","critical_strike_chance","health","health_regen","heavy_hit_chance","knockback","power_physical","power_shielding"],"r":[1,2,3,4],"fx":null,"d":null,"src":"wiki","bs":{"knockback":39,"power_physical":11},"pk":{"1":1,"2":2,"3":3,"4":2}},
 "weapon_t5_staff_foundation_001":{"p":{"precision":12,"focus":15,"will":15},"lvl":42,"sec":["aoe_radius","cooldown_reduction","duration","health","health_regen","power_healing","power_shielding","trigger_ability_chance"],"r":[1,2,3,4],"fx":null,"d":null,"src":"wiki","bs":{"health":80,"power_shielding":28},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "weapon_t5_sword_foundation_001":{"p":{"power":12,"precision":12,"will":12},"lvl":36,"sec":["attack_speed","critical_strike_chance","health","health_regen","heavy_hit_chance","knockback","power_shielding","trigger_ability_chance"],"r":[1,2,3,4],"fx":null,"d":null,"src":"wiki","bs":{"critical_strike_chance":7,"attack_speed":8,"heavy_hit_chance":10},"pk":{"1":1,"2":2,"3":3,"4":3}},
 "weapon_t6_greatsword_virelda_001":{"p":{"power":17,"ferocity":16,"will":16},"lvl":49,"sec":["attack_speed","critical_strike_chance","critical_strike_damage","duration","heavy_hit_chance","knockback","power_physical"],"r":[2,3,4],"fx":null,"d":null,"src":"wiki","bs":{"heavy_hit_chance":18,"power_physical":18},"pk":{"2":2,"3":3,"4":2}},
 "weapon_t6_heavy_neotilus_001":{"p":{"power":17,"focus":16,"ferocity":16},"lvl":49,"sec":["attack_speed","cooldown_reduction","critical_strike_chance","critical_strike_damage","heavy_hit_chance","knockback","power_physical"],"r":[2,3,4],"fx":null,"d":null,"src":"wiki","bs":{"heavy_hit_chance":18,"power_physical":18},"pk":{"2":2,"3":3,"4":2}},
 "weapon_t6_staff_foundation_001":{"p":{"precision":12,"focus":16,"will":17},"lvl":45,"sec":["aoe_radius","cooldown_reduction","critical_strike_chance","critical_strike_damage","dot_potency","duration","heavy_hit_chance","power_healing","power_shielding"],"r":[2,3,4],"fx":null,"d":null,"src":"wiki","bs":{"power_healing":33,"power_shielding":33},"pk":{"2":2,"3":3,"4":2}},
 "weapon_t6_sword_foundation_001":{"p":{"power":12,"precision":12,"will":12},"lvl":36,"sec":["attack_speed","critical_strike_chance","health","health_regen","heavy_hit_chance","knockback","power_shielding"],"r":[2,3,4],"fx":null,"d":null,"src":"wiki","bs":{"critical_strike_chance":8,"attack_speed":8.8,"heavy_hit_chance":11},"pk":{"2":2,"3":3,"4":2}}
};
const ITEM_NAMES={
 "armor_t5_chest_necro_001":"Necrotic Warrior Plate",
 "accessory_t2_belt_001":"Iron Brawler's Belt",
 "accessory_t2_belt_002":"Frostweave Belt",
 "accessory_t2_belt_003":"Sparkthread Belt",
 "accessory_t2_belt_004":"Cindercloth Belt",
 "accessory_t2_belt_005":"Spiritweave Belt",
 "accessory_t2_belt_006":"Voidtouched Belt",
 "accessory_t2_neck_001":"Smuggler's Locket",
 "accessory_t2_necklace_001":"Necklace of Explosions",
 "accessory_t2_necklace_002":"Gunner's Pendant",
 "accessory_t2_necklace_003":"Elemental Pendant",
 "accessory_t2_necklace_004":"Brawler's Pendant",
 "accessory_t3_belt_001":"Warforged Girdle",
 "accessory_t3_belt_002":"Glacial Girdle",
 "accessory_t3_belt_003":"Stormforged Girdle",
 "accessory_t3_belt_004":"Embersteel Girdle",
 "accessory_t3_belt_005":"Ethereal Girdle",
 "accessory_t3_belt_006":"Abyssal Girdle",
 "accessory_t3_necklace_foundation_001":"Encoded Marksman's Pendant",
 "accessory_t3_necklace_lunar_001":"ChronoTehc Warden's Locket",
 "accessory_t3_necklace_neotilus_001":"Voltscale Healer's Pendant",
 "accessory_t3_necklace_virelda_001":"Voltspore Striker's Chain",
 "accessory_t3_ring_001":"Ring of Avoidance",
 "accessory_t3_ring_002":"Catalyst Ring",
 "accessory_t3_ring_003":"Ring of Intimidation",
 "accessory_t3_ring_004":"Double Tap Ring",
 "accessory_t3_ring_005":"Pyrosphere Ring",
 "accessory_t3_ring_006":"Drone Base Count Ring",
 "accessory_t3_ring_007":"Kusarigama Ring",
 "accessory_t3_ring_008":"Always Catch Ring",
 "accessory_t4_belt_001":"Titan's Cinch",
 "accessory_t4_belt_002":"Permafrost Cinch",
 "accessory_t4_belt_003":"Thunderlord's Cinch",
 "accessory_t4_belt_004":"Infernal Cinch",
 "accessory_t4_belt_005":"Phantasmal Cinch",
 "accessory_t4_belt_006":"Nihil Cinch",
 "accessory_t4_necklace_foundation_001":"Obsidian Blast Pendant",
 "accessory_t4_necklace_lunar_001":"Dark Yoku Gunner's Locket",
 "accessory_t4_necklace_neotilus_001":"Tritanium Elemental Pendant",
 "accessory_t4_necklace_virelda_001":"Midnight Brawler's Chain",
 "accessory_t5_belt_001":"Emberline Belt",
 "accessory_t5_belt_002":"Frostline Belt",
 "accessory_t5_belt_003":"Stormline Belt",
 "accessory_t5_belt_004":"Ironline Belt",
 "accessory_t5_belt_005":"Blastline Belt",
 "accessory_t5_belt_006":"Voidline Belt",
 "accessory_t5_necklace_foundation_001":"Viridium Blast Pendant",
 "accessory_t5_necklace_lunar_001":"Viridium Yoku Gunner's Locket",
 "accessory_t5_necklace_neotilus_001":"Viridium Elemental Pendant",
 "accessory_t5_necklace_virelda_001":"Sakura Brawler's Chain",
 "accessory_t6_belt_001":"Emberline Belt",
 "accessory_t6_belt_002":"Frostline Belt",
 "accessory_t6_belt_003":"Stormline Belt",
 "accessory_t6_belt_004":"Ironline Belt",
 "accessory_t6_belt_005":"Blastline Belt",
 "accessory_t6_belt_006":"Voidline Belt",
 "accessory_t6_necklace_foundation_001":"Celestial Blast Pendant",
 "accessory_t6_necklace_lunar_001":"Celestial Yoku Gunner's Locket",
 "accessory_t6_necklace_neotilus_001":"Celestial Elemental Pendant",
 "accessory_t6_necklace_virelda_001":"Starbloom Brawler's Chain",
 "armor_t1_chest_001":"Desert Chest",
 "armor_t1_chest_003":"Vraldean San-Poncho",
 "armor_t1_feet_001":"Soulsand Shoes",
 "armor_t1_head_001":"Desert Hood",
 "armor_t1_head_002":"Desert Hair Wax",
 "armor_t2_chest_001":"Nanofibre Plated Jacket",
 "armor_t2_chest_002":"Nanofibre Sweater",
 "armor_t2_chest_003":"Nanofibre Gi",
 "armor_t2_feet_001":"Nanofibre Threaded Pants",
 "armor_t2_feet_002":"Nanofibre Cargos",
 "armor_t2_feet_003":"Nanofibre Treads",
 "armor_t2_feet_004":"Experimental Cargo Pants",
 "armor_t2_head_001":"Nanofibre Vizor",
 "armor_t2_head_002":"Nanofibre Beanie",
 "armor_t2_head_003":"Nanofibre Lenses",
 "armor_t2_head_004":"Idealist's Cowl",
 "armor_t3_chest_foundation_001":"Encoded Cuirass",
 "armor_t3_chest_lunar_001":"ChronoTehc Padded Cloak",
 "armor_t3_chest_neotilus_001":"Voltscale Chest",
 "armor_t3_feet_foundation_001":"Encoded Boots",
 "armor_t3_feet_lunar_001":"ChronoTehc Boots",
 "armor_t3_feet_neotilus_001":"Voltscale Legguards",
 "armor_t3_head_foundation_001":"Encoded Helm",
 "armor_t3_head_lunar_001":"ChronoTehc Hood",
 "armor_t3_head_neotilus_001":"Voltscale Visor",
 "armor_t4_chest_foundation_001":"Obsidian Jacket",
 "armor_t4_chest_lunar_001":"Dark Obsidian Chest",
 "armor_t4_chest_neotilus_001":"Obsidian Kimono",
 "armor_t4_chest_virelda_001":"Midnight Kimono",
 "armor_t4_feet_foundation_001":"Obsidian Cargos",
 "armor_t4_feet_lunar_001":"Dark Obsidian Legs",
 "armor_t4_feet_neotilus_001":"Obsidian Clogs",
 "armor_t4_feet_virelda_001":"Midnight Legwraps",
 "armor_t4_head_foundation_001":"Obsidian Visor",
 "armor_t4_head_lunar_001":"Dark Obsidian Helm",
 "armor_t4_head_neotilus_001":"Yokunized Eyepatch",
 "armor_t4_head_virelda_001":"Midnight Hair",
 "armor_t5_chest_foundation_001":"Foundation Bulwark Chestguard",
 "armor_t5_chest_lunar_001":"Lunar Conduit Robe",
 "armor_t5_chest_neotilus_001":"Neotilus Trailseeker Coat",
 "armor_t5_chest_virelda_001":"Virelda Warcrest Cuirass",
 "armor_t5_feet_foundation_001":"Foundation Bulwark Greaves",
 "armor_t5_feet_lunar_001":"Lunar Conduit Treads",
 "armor_t5_feet_necro_001":"Necrotic Warrior Boots",
 "armor_t5_feet_neotilus_001":"Neotilus Trailseeker Boots",
 "armor_t5_feet_virelda_001":"Virelda Warcrest Greaves",
 "armor_t5_head_foundation_001":"Foundation Bulwark Helm",
 "armor_t5_head_necro_001":"Necrotic Warrior Crown",
 "armor_t5_head_lunar_001":"Lunar Conduit Crown",
 "armor_t5_head_neotilus_001":"Neotilus Trailseeker Visor",
 "armor_t5_head_virelda_001":"Virelda Warcrest Helm",
 "armor_t6_chest_foundation_001":"Foundation Bulwark Chestguard",
 "armor_t6_chest_lunar_001":"Lunar Conduit Robe",
 "armor_t6_chest_neotilus_001":"Neotilus Trailseeker Coat",
 "armor_t6_chest_virelda_001":"Virelda Warcrest Cuirass",
 "armor_t6_feet_foundation_001":"Foundation Bulwark Greaves",
 "armor_t6_feet_lunar_001":"Lunar Conduit Treads",
 "armor_t6_feet_neotilus_001":"Neotilus Trailseeker Boots",
 "armor_t6_feet_virelda_001":"Virelda Warcrest Greaves",
 "armor_t6_head_foundation_001":"Foundation Bulwark Helm",
 "armor_t6_head_lunar_001":"Lunar Conduit Crown",
 "armor_t6_head_neotilus_001":"Neotilus Trailseeker Visor",
 "armor_t6_head_virelda_001":"Virelda Warcrest Helm",
 "weapon_t1_greatsword_001":"Desert Spine",
 "weapon_t1_greatsword_002":"Basic Claymore",
 "weapon_t1_heavy_001":"Dune Hammer",
 "weapon_t1_heavy_002":"Basic Hammer",
 "weapon_t1_staff_001":"Sandstorm Staff",
 "weapon_t1_sword_001":"Copper Katana",
 "weapon_t1_sword_002":"Iron Cutlass",
 "weapon_t2_greatsword_001":"Thorncore Greatsword",
 "weapon_t2_heavy_001":"Thorncore Axe",
 "weapon_t2_staff_001":"Thorncore Staff",
 "weapon_t2_sword_001":"Thorncore Cleaver",
 "weapon_t3_greatsword_neotilus_001":"Voltscale Broadsword",
 "weapon_t3_greatsword_virelda_001":"Voltspore Greatsword",
 "weapon_t3_heavy_lunar_001":"Voltlite Axe",
 "weapon_t3_heavy_neotilus_001":"Voltscale Axe",
 "weapon_t3_staff_foundation_001":"Encoded Staff",
 "weapon_t3_staff_lunar_001":"Voltlite Staff",
 "weapon_t3_sword_foundation_001":"Encoded Cleaver",
 "weapon_t3_sword_virelda_001":"Voltspore Cleaver",
 "weapon_t4_greatsword_neotilus_001":"Tritanium Greatsword",
 "weapon_t4_greatsword_virelda_001":"Redeemed Yoku Sword",
 "weapon_t4_heavy_lunar_001":"Dark Yoku Hammer",
 "weapon_t4_heavy_neotilus_001":"Tritanium Hammer",
 "weapon_t4_staff_foundation_001":"Tritanium Staff",
 "weapon_t4_staff_lunar_001":"Dark Yoku Staff",
 "weapon_t4_sword_foundation_001":"Cursed Tritanium Sword",
 "weapon_t4_sword_virelda_001":"Erupted Yoku Katana",
 "weapon_t5_greatsword_neotilus_001":"Viridium Greatsword",
 "weapon_t5_greatsword_virelda_001":"Erupted Viridium Greatsword",
 "weapon_t5_heavy_lunar_001":"Viridium Yoku Hammer",
 "weapon_t5_heavy_neotilus_001":"Viridium Hammer",
 "weapon_t5_staff_foundation_001":"Viridium Staff",
 "weapon_t5_staff_lunar_001":"Viridium Yoku Staff",
 "weapon_t5_sword_foundation_001":"Cursed Viridium Sword",
 "weapon_t5_sword_virelda_001":"Erupted Viridium Katana",
 "weapon_t6_greatsword_neotilus_001":"Celestial Greatsword",
 "weapon_t6_greatsword_virelda_001":"Redeemed Celestial Greatsword",
 "weapon_t6_heavy_lunar_001":"Celestial Yoku Hammer",
 "weapon_t6_heavy_neotilus_001":"Celestial Hammer",
 "weapon_t6_staff_foundation_001":"Celestial Staff",
 "weapon_t6_staff_lunar_001":"Celestial Yoku Staff",
 "weapon_t6_sword_foundation_001":"Cursed Celestial Sword",
 "weapon_t6_sword_virelda_001":"Redeemed Celestial Katana"
};
const FLAVOUR={
"accessory_t3_belt_006":"Stare into the buckle long enough and the buckle stares back. Found in Fractured dungeon chests.",
"accessory_t3_ring_008":"Hands like magnets. If it comes flying back, you are catching it. Found in Fractured and Collapsing dungeon chests.",
"weapon_t1_greatsword_002":"The desert keeps these in chests, presumably so it stops cutting itself. Found in Stable dungeon chests.",
"weapon_t1_heavy_002":"It says basic right on the label, and it means it. Found in Stable dungeon chests.",
"accessory_t5_belt_005":"Found in Volatile dungeon chests.",
"accessory_t6_belt_005":"Found in Cataclysmic dungeon chests.",
"accessory_t2_necklace_004":"Get hit, shrug, swing back. Stun is for other people. Forged at the Gearforge.",
"accessory_t3_ring_002":"Whatever is melting your enemies, this makes it melt faster and meaner. Found in Fractured and Collapsing dungeon chests.",
"accessory_t6_necklace_foundation_001":"Foundation-pattern necklace, primed for combat. Forged at the Gearforge.",
"accessory_t6_necklace_neotilus_001":"Neotilus-pattern necklace, primed for combat. Forged at the Gearforge.",
"weapon_t6_greatsword_neotilus_001":"Forged at the Weapon Bench, or found in Cataclysmic dungeon chests.",
"weapon_t6_heavy_neotilus_001":"Forged at the Weapon Bench, or found in Cataclysmic dungeon chests.",
"weapon_t6_staff_foundation_001":"Forged at the Weapon Bench, or found in Cataclysmic dungeon chests.",
"accessory_t6_necklace_lunar_001":"Lunar-pattern necklace, primed for combat. Forged at the Gearforge.",
"weapon_t6_heavy_lunar_001":"Forged at the Weapon Bench, or found in Cataclysmic dungeon chests.",
"weapon_t6_staff_lunar_001":"Forged at the Weapon Bench, or found in Cataclysmic dungeon chests.",
"armor_t3_feet_lunar_001":"Each step lands a fraction before you take it. Forged at the Gearforge, or found in Fractured dungeon chests.",
"armor_t3_head_lunar_001":"A Lunar-pattern hood for keeping time on your side. Forged at the Gearforge, or found in Fractured dungeon chests.",
"armor_t3_chest_lunar_001":"Lunar-pattern padding, snug as moonlight. Forged at the Gearforge, or found in Fractured dungeon chests.",
"accessory_t3_necklace_lunar_001":"Lunar-pattern timekeeping for wardens who would rather block than dodge. Forged at the Gearforge.",
"accessory_t2_belt_004":"Smells faintly of campfire. Worryingly, it is the campfire. Found in Stable, Unstable and Fractured dungeon chests.",
"weapon_t1_sword_001":"Proof that copper holds an edge if you ask nicely. Forged at the Weapon Bench, or found in Stable dungeon chests.",
"weapon_t6_sword_foundation_001":"Forged at the Weapon Bench, or found in Cataclysmic dungeon chests.",
"weapon_t4_sword_foundation_001":"Forged at the Weapon Bench. The curse is probably just a rounding error. Found in Collapsing dungeon chests.",
"weapon_t5_sword_foundation_001":"Forged at the Weapon Bench, or found in Volatile dungeon chests.",
"armor_t4_chest_lunar_001":"Lunar-pattern plate, drinks the light. Forged at the Gearforge, or found in Collapsing dungeon chests.",
"armor_t4_head_lunar_001":"Like a normal helm, but darker. Forged at the Gearforge, or found in Collapsing dungeon chests.",
"armor_t4_feet_lunar_001":"So dark your shadow files a complaint. Forged at the Gearforge, or found in Collapsing dungeon chests.",
"accessory_t4_necklace_lunar_001":"There is a sliver of Dark Yoku in here, and your gun knows it. Forged at the Gearforge.",
"weapon_t4_heavy_lunar_001":"Hits like a bad omen. Forged at the Weapon Bench, or found in Collapsing dungeon chests.",
"weapon_t4_staff_lunar_001":"A Dark Yoku Shard on a Tritanium pole, what could possibly go wrong. Forged at the Weapon Bench, or found in Collapsing dungeon chests.",
"armor_t1_chest_001":"Standard-issue desert plating, sand not included. Forged at the Gearforge, or found in Stable dungeon chests.",
"armor_t1_head_002":"Strong hold, stronger opinions. Somehow counts as armor. Forged at the Gearforge, or found in Stable dungeon chests.",
"armor_t1_head_001":"Keeps the sand out and the mystery in. Forged at the Gearforge, or found in Stable dungeon chests.",
"weapon_t1_greatsword_001":"A copper slab with a grudge. Forged at the Weapon Bench, or found in Stable dungeon chests.",
"accessory_t3_ring_004":"One squeeze of the trigger, twice the paperwork for your enemies. Found in Fractured and Collapsing dungeon chests.",
"accessory_t3_ring_006":"More drones for your personal airspace, air traffic control not included. Found in Fractured and Collapsing dungeon chests.",
"weapon_t1_heavy_001":"Heavy enough to flatten a dune. Forged at the Weapon Bench, or found in Stable dungeon chests.",
"accessory_t2_necklace_003":"The elements always seem to find the weak spots when you wear this. Forged at the Gearforge.",
"accessory_t5_belt_001":"Found in Volatile dungeon chests.",
"accessory_t6_belt_001":"Found in Cataclysmic dungeon chests.",
"accessory_t3_belt_004":"The steel cooled. The embers refused. Found in Fractured dungeon chests.",
"armor_t3_feet_foundation_001":"Foundation-pattern boots running firmware older than the desert. Forged at the Gearforge, or found in Fractured dungeon chests.",
"weapon_t3_sword_foundation_001":"A Foundation-pattern blade forged at the Weapon Bench from Voltedge and Encoded Yoku. It knows your next move. Found in Fractured dungeon chests.",
"armor_t3_chest_foundation_001":"Foundation-pattern plate, data included. Forged at the Gearforge, or found in Fractured dungeon chests.",
"armor_t3_head_foundation_001":"Foundation-pattern plating with secrets baked in. Forged at the Gearforge, or found in Fractured dungeon chests.",
"accessory_t3_necklace_foundation_001":"Foundation-pattern tech that hurries your shots along; bullets hate being late. Forged at the Gearforge.",
"weapon_t3_staff_foundation_001":"A Foundation-pattern staff running on Encoded Yoku. Forged at the Weapon Bench, or found in Fractured dungeon chests.",
"weapon_t5_greatsword_virelda_001":"Forged at the Weapon Bench, or found in Volatile dungeon chests.",
"weapon_t5_sword_virelda_001":"Forged at the Weapon Bench, or found in Volatile dungeon chests.",
"weapon_t4_sword_virelda_001":"A Yoku Bloom went off mid-forge and the Weapon Bench survived. Forged at the Weapon Bench, or found in Collapsing dungeon chests.",
"accessory_t3_belt_005":"Weighs almost nothing, which is suspicious for a girdle. Found in Fractured dungeon chests.",
"armor_t2_feet_004":"Experimental, as in nobody signed the safety paperwork. The pockets hum if you stand still too long.",
"armor_t6_chest_foundation_001":"Foundation-pattern chest piece. Forged at the Gearforge, or found in Cataclysmic dungeon chests.",
"armor_t5_chest_foundation_001":"Foundation-pattern chest piece. Forged at the Gearforge, or found in Volatile dungeon chests.",
"armor_t5_feet_foundation_001":"Foundation-pattern feet piece. Forged at the Gearforge, or found in Volatile dungeon chests.",
"armor_t6_feet_foundation_001":"Foundation-pattern feet piece. Forged at the Gearforge, or found in Cataclysmic dungeon chests.",
"armor_t5_head_foundation_001":"Foundation-pattern head piece. Forged at the Gearforge, or found in Volatile dungeon chests.",
"armor_t6_head_foundation_001":"Foundation-pattern head piece. Forged at the Gearforge, or found in Cataclysmic dungeon chests.",
"accessory_t5_belt_002":"Found in Volatile dungeon chests.",
"accessory_t6_belt_002":"Found in Cataclysmic dungeon chests.",
"accessory_t2_belt_002":"Woven from threads that never quite thawed. Found in Stable, Unstable and Fractured dungeon chests.",
"accessory_t3_belt_002":"Moves at its own pace, like all good glaciers. The cold it carries does not. Found in Fractured dungeon chests.",
"accessory_t2_necklace_002":"For the gunner who hates reloading almost as much as missing. Forged at the Gearforge.",
"armor_t2_head_004":"For those who still believe talking can fix things. Diplomacy looks better with the hood up.",
"accessory_t4_belt_004":"Runs a little hot. Fine for you, less fine for whatever you're swinging at. Found in Collapsing dungeon chests.",
"accessory_t2_belt_001":"A no-nonsense strap for fist-based problem solving. Found in Stable, Unstable and Fractured dungeon chests.",
"weapon_t1_sword_002":"T1 Weapon",
"accessory_t5_belt_004":"Found in Volatile dungeon chests.",
"accessory_t6_belt_004":"Found in Cataclysmic dungeon chests.",
"accessory_t3_ring_007":"Because one scythe was clearly never going to be enough. Found in Fractured and Collapsing dungeon chests.",
"armor_t5_head_lunar_001":"Lunar-pattern head piece. Forged at the Gearforge, or found in Volatile dungeon chests.",
"armor_t6_head_lunar_001":"Lunar-pattern head piece. Forged at the Gearforge, or found in Cataclysmic dungeon chests.",
"armor_t5_chest_lunar_001":"Lunar-pattern chest piece. Forged at the Gearforge, or found in Volatile dungeon chests.",
"armor_t6_chest_lunar_001":"Lunar-pattern chest piece. Forged at the Gearforge, or found in Cataclysmic dungeon chests.",
"armor_t5_feet_lunar_001":"Lunar-pattern feet piece. Forged at the Gearforge, or found in Volatile dungeon chests.",
"armor_t6_feet_lunar_001":"Lunar-pattern feet piece. Forged at the Gearforge, or found in Cataclysmic dungeon chests.",
"accessory_t4_necklace_virelda_001":"Blooms only at midnight, hits hard around the clock. Forged at the Gearforge.",
"armor_t4_head_virelda_001":"Hair so dark it absorbs compliments. Forged at the Gearforge, or found in Collapsing dungeon chests.",
"armor_t4_chest_virelda_001":"Midnight cut, garden grown. Forged at the Gearforge, or found in Collapsing dungeon chests.",
"armor_t4_feet_virelda_001":"Wraps the colour of a desert midnight. Forged at the Gearforge, or found in Collapsing dungeon chests.",
"armor_t2_head_002":"Slouchy on the outside, supercomputer on the inside. Forged at the Gearforge, or found in Unstable dungeon chests.",
"armor_t2_feet_002":"Pockets woven at the molecular level. Still not enough pockets. Forged at the Gearforge, or found in Unstable dungeon chests.",
"armor_t2_chest_003":"For the martial artist who blocks with style. Forged at the Gearforge, or found in Unstable dungeon chests.",
"armor_t2_head_003":"Perfect for watching enemies slowly regret their choices. Forged at the Gearforge, or found in Unstable dungeon chests.",
"armor_t2_chest_001":"Plated for business, cut for comfort. Forged at the Gearforge, or found in Unstable dungeon chests.",
"armor_t2_chest_002":"A cosy sweater spun from battle-grade Nanofibre. Forged at the Gearforge, or found in Unstable dungeon chests.",
"armor_t2_feet_001":"Stitched from threads too small to argue with. Forged at the Gearforge, or found in Unstable dungeon chests.",
"armor_t2_feet_003":"Treads that grip like they hold a grudge. Forged at the Gearforge, or found in Unstable dungeon chests.",
"armor_t2_head_001":"Spelled with a z for extra speed. Forged at the Gearforge, or found in Unstable dungeon chests.",
"accessory_t2_necklace_001":"Why have a small explosion when you could have a huge one? Forged at the Gearforge.",
"armor_t5_feet_neotilus_001":"Neotilus-pattern feet piece. Forged at the Gearforge, or found in Volatile dungeon chests.",
"armor_t6_feet_neotilus_001":"Neotilus-pattern feet piece. Forged at the Gearforge, or found in Cataclysmic dungeon chests.",
"armor_t5_chest_neotilus_001":"Neotilus-pattern chest piece. Forged at the Gearforge, or found in Volatile dungeon chests.",
"armor_t6_chest_neotilus_001":"Neotilus-pattern chest piece. Forged at the Gearforge, or found in Cataclysmic dungeon chests.",
"armor_t5_head_neotilus_001":"Neotilus-pattern head piece. Forged at the Gearforge, or found in Volatile dungeon chests.",
"armor_t6_head_neotilus_001":"Neotilus-pattern head piece. Forged at the Gearforge, or found in Cataclysmic dungeon chests.",
"accessory_t4_belt_006":"A belt made of nothing, holding back more nothing. Found in Collapsing dungeon chests.",
"accessory_t4_necklace_foundation_001":"Foundation-pattern obsidian with a short fuse and even shorter cooldowns. Forged at the Gearforge.",
"armor_t4_feet_foundation_001":"Foundation-pattern cargos, dark as a power cut. Forged at the Gearforge, or found in Collapsing dungeon chests.",
"armor_t4_feet_neotilus_001":"Heavy clogs that clack like thunder. Forged at the Gearforge, or found in Collapsing dungeon chests.",
"armor_t4_chest_foundation_001":"Foundation-pattern, edges everywhere. Forged at the Gearforge, or found in Collapsing dungeon chests.",
"armor_t4_chest_neotilus_001":"Forged at the Gearforge. Yes, the fillet goes in the armour. Found in Collapsing dungeon chests.",
"armor_t4_head_foundation_001":"Sees everything, reflects nothing. Forged at the Gearforge, or found in Collapsing dungeon chests.",
"accessory_t4_belt_002":"Permanently frosty, exactly as advertised. Found in Collapsing dungeon chests.",
"accessory_t4_belt_005":"You can see right through it, yet somehow it still holds. Found in Collapsing dungeon chests.",
"accessory_t3_ring_005":"One extra ball of blazing regret, and your crits really commit. Found in Fractured and Collapsing dungeon chests.",
"weapon_t6_greatsword_virelda_001":"Forged at the Weapon Bench, or found in Cataclysmic dungeon chests.",
"weapon_t6_sword_virelda_001":"Forged at the Weapon Bench, or found in Cataclysmic dungeon chests.",
"weapon_t4_greatsword_virelda_001":"It used to be angrier. Forged at the Weapon Bench, or found in Collapsing dungeon chests.",
"accessory_t3_ring_001":"The best hit is the one that never lands on you. Found in Fractured and Collapsing dungeon chests.",
"accessory_t3_ring_003":"Makes every mob in the room take it personally. Wear thick skin. Found in Fractured and Collapsing dungeon chests.",
"accessory_t5_necklace_virelda_001":"Virelda-pattern necklace, primed for combat. Forged at the Gearforge.",
"weapon_t1_staff_001":"Kicks up trouble in a wide radius, true to its name. Forged at the Weapon Bench, or found in Stable dungeon chests.",
"accessory_t2_neck_001":"A locket with hidden compartments and a shadier past. Found in Unstable and Fractured dungeon chests, or dropped by dungeon mobs.",
"armor_t1_feet_001":"There's sand in them and there always will be. Forged at the Gearforge, or found in Stable dungeon chests.",
"accessory_t2_belt_003":"Every thread carries a small grudge and a static charge. Found in Stable, Unstable and Fractured dungeon chests.",
"accessory_t2_belt_005":"Half the fabric is here, the rest somewhere more ethereal. Found in Stable, Unstable and Fractured dungeon chests.",
"accessory_t6_necklace_virelda_001":"Virelda-pattern necklace, primed for combat. Forged at the Gearforge.",
"accessory_t3_belt_003":"Forged in a storm, or at least very near one. Found in Fractured dungeon chests.",
"accessory_t5_belt_003":"Found in Volatile dungeon chests.",
"accessory_t6_belt_003":"Found in Cataclysmic dungeon chests.",
"weapon_t2_heavy_001":"An axe with a thorny disposition. Forged at the Weapon Bench, or found in Unstable dungeon chests. The quest 'N-Everdune' wants one.",
"weapon_t2_sword_001":"Thorncore ground to a quick, spiteful edge. Forged at the Weapon Bench, or found in Unstable dungeon chests.",
"weapon_t2_greatsword_001":"Three Thorncores hammered into one bad idea. Forged at the Weapon Bench, or found in Unstable dungeon chests.",
"weapon_t2_staff_001":"Channels a sting that lingers well past polite. Forged at the Weapon Bench, or found in Unstable dungeon chests.",
"accessory_t4_belt_003":"The thunderlord doesn't miss it. Probably. Best not to ask. Found in Collapsing dungeon chests.",
"accessory_t4_belt_001":"Sized for a titan, cinched for you. Found in Collapsing dungeon chests.",
"accessory_t4_necklace_neotilus_001":"Yes, that is a fillet of pure Yoku in the setting. Connoisseurs hit harder. Forged at the Gearforge.",
"weapon_t4_greatsword_neotilus_001":"Forged at the Weapon Bench. Yes, the fillet is load-bearing. Found in Collapsing dungeon chests.",
"weapon_t4_heavy_neotilus_001":"Yes, the recipe really calls for a fillet. Forged at the Weapon Bench, or found in Collapsing dungeon chests.",
"weapon_t4_staff_foundation_001":"Quantised Yoku Data in a Tritanium frame. Forged at the Weapon Bench, or found in Collapsing dungeon chests.",
"armor_t5_chest_virelda_001":"Virelda-pattern chest piece. Forged at the Gearforge, or found in Volatile dungeon chests.",
"armor_t6_chest_virelda_001":"Virelda-pattern chest piece. Forged at the Gearforge, or found in Cataclysmic dungeon chests.",
"armor_t5_feet_virelda_001":"Virelda-pattern feet piece. Forged at the Gearforge, or found in Volatile dungeon chests.",
"armor_t6_feet_virelda_001":"Virelda-pattern feet piece. Forged at the Gearforge, or found in Cataclysmic dungeon chests.",
"armor_t5_head_virelda_001":"Virelda-pattern head piece. Forged at the Gearforge, or found in Volatile dungeon chests.",
"armor_t6_head_virelda_001":"Virelda-pattern head piece. Forged at the Gearforge, or found in Cataclysmic dungeon chests.",
"accessory_t5_necklace_foundation_001":"Foundation-pattern necklace, primed for combat. Forged at the Gearforge.",
"accessory_t5_necklace_neotilus_001":"Neotilus-pattern necklace, primed for combat. Forged at the Gearforge.",
"weapon_t5_greatsword_neotilus_001":"Forged at the Weapon Bench, or found in Volatile dungeon chests.",
"weapon_t5_heavy_neotilus_001":"Forged at the Weapon Bench, or found in Volatile dungeon chests.",
"weapon_t5_staff_foundation_001":"Forged at the Weapon Bench, or found in Volatile dungeon chests.",
"accessory_t5_necklace_lunar_001":"Lunar-pattern necklace, primed for combat. Forged at the Gearforge.",
"weapon_t5_heavy_lunar_001":"Forged at the Weapon Bench, or found in Volatile dungeon chests.",
"weapon_t5_staff_lunar_001":"Forged at the Weapon Bench, or found in Volatile dungeon chests.",
"accessory_t5_belt_006":"Found in Volatile dungeon chests.",
"accessory_t6_belt_006":"Found in Cataclysmic dungeon chests.",
"accessory_t2_belt_006":"It holds your trousers up and the void in. Mostly. Found in Stable, Unstable and Fractured dungeon chests.",
"weapon_t3_heavy_lunar_001":"Lunar-pattern edge with a live current running through it. Forged at the Weapon Bench, or found in Fractured dungeon chests.",
"weapon_t3_staff_lunar_001":"A Lunar-pattern staff humming with stored charge. Forged at the Weapon Bench, or found in Fractured dungeon chests.",
"weapon_t3_heavy_neotilus_001":"Neotilus-pattern plating, scaled for trouble. Forged at the Weapon Bench, or found in Fractured dungeon chests.",
"weapon_t3_greatsword_neotilus_001":"Forged at the Weapon Bench. Hums faintly, like it knows something you don't. Found in Fractured dungeon chests.",
"armor_t3_chest_neotilus_001":"Neotilus-pattern scales with a live current. Forged at the Gearforge, or found in Fractured dungeon chests.",
"accessory_t3_necklace_neotilus_001":"A scale that hums with restorative charge, keeping healers topped up and smug. Forged at the Gearforge.",
"armor_t3_feet_neotilus_001":"Neotilus-pattern scales with a faint static crackle. Forged at the Gearforge, or found in Fractured dungeon chests.",
"armor_t3_head_neotilus_001":"Neotilus-pattern scales with a faint electric hum. Forged at the Gearforge, or found in Fractured dungeon chests.",
"weapon_t3_sword_virelda_001":"Voltedge and a Yoku Spore, forged into a quick temper at the Weapon Bench. Found in Fractured dungeon chests.",
"weapon_t3_greatsword_virelda_001":"Forged at the Weapon Bench. The spore did not survive; the attitude did. Found in Fractured dungeon chests.",
"accessory_t3_necklace_virelda_001":"Strikers swear this sparking spore makes them faster. Forged at the Gearforge, or a rare drop from mobs in Collapsing dungeons.",
"armor_t1_chest_003":"Vraldean sun-wear: one hole for your head, zero opinions about the heat. Found in Stable dungeon chests.",
"accessory_t3_belt_001":"Hammered flat, strapped on, ready to hammer something else. Found in Fractured dungeon chests.",
"armor_t4_head_neotilus_001":"Half the vision, twice the style, faint smell of fish. Forged at the Gearforge, or found in Collapsing dungeon chests."
};;
const RELICS={
 "healing_pulse":{"b":{"Benediction":{"t":["+3 heal amount","+3 heal amount","+4 heal amount"]},"Consecration":{"t":["Also damages enemies for the same amount it heals. Becomes consecrated.","+50% Consecrated Pulse damage.","Also applies a burn to enemies for 5s."]},"Resonance":{"t":["+25% pulse size.","-10% cooldown."]}},"s":[]},
 "bomb":{"b":{"Cluster Bomb":{"t":["Splits into 3 cluster bombs on explosion."]},"Engineer":{"t":["Creates a smoke cloud (6s) that stuns enemies. Allies gain +30% dodge.","Smoke cloud heals allies for 2 HP/sec.","Throwing grants +40% movement speed for 4s."]},"Fire Bomb":{"t":["Converts to fire damage. Leaves a fire zone (48px, 5s). -10% fire damage, -10% fire resistance.","Fire zone ignites enemies for 3 burn ticks."],"dot":1,"conv":"FIRE"},"Physical Charge":{"t":["Converts to physical damage with massive knockback.","Blast leaves an impact crater (1s). Enemies take -30% physical resistance for 3s."],"conv":"PHYSICAL"},"Proximity Mine":{"t":["Explosions leave a proximity mine: danger zone (4s). Enemies entering trigger full detonation.","Untriggered zone arms: bigger area, stronger detonation (+60% damage, +30% radius).","Armed detonation deals +120% damage and applies Demolished (-30% all resistances, 5s)."]}},"s":[{"t":"+100% blast radius."},{"t":"+15% AoE radius."},{"t":"Crits trigger a secondary explosion."},{"t":"+20% knockback."},{"t":"Hit 5+ enemies with one blast to reduce cooldown by 50% for 10s."},{"t":"+15% crit chance."},{"t":"-20% cooldown."},{"t":"+10% damage."},{"t":"+100% throw range."},{"t":"+80% damage. +50% critical strike damage."},{"t":"-50% fuse timer."}]},
 "pyrosphere":{
  "b":{"Accelerant Core":{"t":["-50% cooldown. -40% damage."]},"Critical Eruption":{"t":["Critical strikes detonate a secondary explosion at impact.","Eruption crits trigger a third explosion.","Second blast deals +30% damage. Third deals +60% damage. Each blast grows larger."]},"Gravity Well":{"t":["Converts to void damage. Explosions spawn black holes (2s) that pull and damage enemies. -20% damage.","Black holes last +50% longer (3s). Erupt in a void explosion on expiry."],"conv":"VOID"},"Pyroclasm":{"t":["-40% AoE radius. +30% damage. +20% critical strike chance.","Each crit grants +5% fire damage for 4s (max +20%, 4 stacks).","Landing a crit grants +1 projectile for 5s."]},"Pyromania":{"t":["Ignites enemies with spreading burns that chain to nearby foes.","Critical hits release homing fireballs that ignite on contact.","Each impact erupts in a shockwave around you, igniting all nearby enemies."],"dot":1},"Scorch":{"t":["+30% damage.","+60% damage."]},"Scorched Earth":{"t":["Explosions leave scorched zones that burn enemies within.","Enemies entering scorched zones trigger new burning zones.","Scorched zones erupt on expiry, damaging and burning all enemies."],"dot":1},"Shockwave":{"t":["+50% area of effect.","+100% area of effect."]},"Stormcaller":{"t":["Converts to lightning damage. Chance to electrocute impacted enemies. -20% damage.","Lightning chains to 3 enemies. -40% lightning resistance for 3s."],"conv":"LIGHTNING"}},
  "s":[{"t":"+100% AoE radius. +50% cooldown."},{"t":"+30 crit chance."},{"t":"+10% cooldown reduction."},{"t":"Burn effects last +25% longer.","dot":1},{"t":"+25% damage on direct contact."},{"t":"+60% range."},{"t":"Charges on hit (5 stacks). Next pyrosphere: +200% radius, +150% damage."},{"t":"+30% damage. Burn/fire DoT effects last -50% shorter."},{"t":"20% chance on crit to fire an extra projectile."},{"t":"Converts to lightning damage.","conv":"LIGHTNING"}]
 },
 "smg_gleamtwins":{"b":{"Ballistic Twins":{"t":["Converts Gleam Twins damage to PHYSICAL.","Physical rounds have a 10% chance to stun enemies for 1s."],"conv":"PHYSICAL"},"Cinder Twins":{"t":["Converts Gleam Twins damage to FIRE.","Fire rounds have a 25% chance to burn enemies for 2s.","Increases all fire damage dealt by +10%."],"dot":1,"conv":"FIRE"},"Crossfire":{"t":["+20% range.","+50% arc width.","+25% duration."]},"Mirror Image":{"t":["Spawns a phantom Gleam Twins that mirrors your assault.","+1s duration.","On use, gain +20% movement speed for 2s."]},"Needle Rounds":{"t":["+20% critical strike chance.","Crits grant +1% damage for 5s. Stacks up to 30.","+50% critical strike damage."]},"Overclock":{"t":["+20% fire rate.","-20% cooldown.","Damage increased by +25% and fire rate increased by +35%."]}},"s":[]},
 "staff_weapon":{"b":{"Ethereal Duality":{"t":["Converts to explosive damage. Each cast fires a healing orb (5 HP) and a damage orb (60% damage). -40% explosive damage.","Healing orbs grant +15% attack speed (3s). Damage orbs slow enemies 40% (2s)."],"conv":"EXPLOSIVE"},"Kinetic Force":{"t":["Converts to physical damage. +50% knockback. 25% stun chance (1s). -15% physical damage. -10% void resistance.","Stunned enemies take +30% damage. +100% knockback."],"conv":"PHYSICAL"},"Phantom Barrage":{"t":["Each cast fires a phantom sphere that seeks the nearest enemy.","On hit, a second sphere spawns and seeks a nearby enemy (50% damage).","Fire 2 phantom spheres per cast (up to 4 enemies hit per cast)."]},"Void Rift":{"t":["Every 5 casts, tear open a Void Rift (6s). Allies passing through gain +10% ability damage for 5s.","Enemies passing through the rift suffer -20% void resistance for 4s.","Void Rift implodes on expiry, pulling enemies in and dealing damage."]},"Void Surge":{"t":["Each cast builds Void Energy (max 5, 8s). At 5 stacks, next cast fires a void burst for 200% damage.","Void burst applies -20% void resistance for 4s.","Void burst radius increased. +50% additional damage (total 250%)."]}},"s":[{"t":"Each kill grants Cascading Power (4s, max 10 stacks). +5% damage per stack (max +50%)."},{"t":"+15% AoE radius. -5% damage."},{"t":"+100% damage. +100% cooldown."},{"t":"+50% cast range. +50% AoE radius."},{"t":"-50% cooldown. -50% damage."},{"t":"+10% cooldown reduction."},{"t":"+1 additional void sphere per cast. +30% cooldown."},{"t":"+10% critical damage."},{"t":"+15% projectile speed. +5% critical strike chance."},{"t":"Each cast builds Void Focus (5s, max 5 stacks). +5% crit chance per stack (max +25%)."},{"t":"+20% damage."}]},
 "hammer_weapon":{"b":{"Bulwark":{"t":["Each hit grants a Bulwark stack. At 3 stacks, next slam Fortifies, granting you and allies 5 shield for 5s.","Fortify also grants +30% weapon damage for 5s.","Shield increases to 15. Grants Unbreakable (5s): +30% hammer damage, +30% AoE radius."]},"Concussive Impact":{"t":["Shockwaves have a 20% chance to stun enemies.","Stunned enemies take +60% damage from all sources."]},"Frostbreaker":{"t":["Converts to cold damage. Slows enemies 50% for 3s. -10% cold damage. -10% fire resistance.","As chill fades, frozen enemies shatter, taking +50% bonus damage."],"conv":"COLD"},"Stormbreaker":{"t":["Converts to lightning damage, chaining to 1 enemy. -10% lightning damage. -10% physical resistance.","Lightning deals +30% damage, stuns, and chains to 3 enemies."],"conv":"LIGHTNING"},"Tremors":{"t":["+1 additional shockwave.","Shockwaves grow +50% larger.","+1 additional shockwave. All shockwaves generate +50% threat."]}},"s":[{"t":"+20% AoE radius. -10% damage."},{"t":"+50% damage. -25% all resistances."},{"t":"Each hit grants Earthshaker (6s, max 20 stacks). +2% damage and +1% AoE per stack (max +40% damage, +20% AoE)."},{"t":"+30% AoE radius. -25% damage."},{"t":"Heavy hits grant Momentum (5s): +40% AoE radius. Devastating blows create massive shockwaves."},{"t":"+50% threat generation. Enemies attacking you deal -20% damage."},{"t":"+40% AoE radius. -15% physical, fire, and poison resistance."},{"t":"+10% attack speed."},{"t":"+40% heavy hit chance. +20% heavy hit damage. -15% movement speed."}]},
 "melee_weapon":{"b":{"Precise Strikes":{"t":["Critical strikes trigger a follow-up swing.","Follow-up swings always crit. -10% physical resistance for 2s.","Follow-up swings have a 50% chance to chain into another swing."]},"Quicksilver":{"t":["+25% attack speed.","+40% attack speed."]},"Rally Cry":{"t":["Critical strikes grant nearby allies +25% attack speed for 5s.","Rally also grants allies +20% weapon damage for 5s.","Landing 3 crits within 15s empowers next rally: +50% weapon damage."]},"Whetstone":{"t":["+20 crit chance.","+40 crit chance."]}},"s":[{"t":"+30% swing size."},{"t":"+60% critical strike damage. -15% critical strike chance."},{"t":"+25% range. and +10% cone breadth."},{"t":"+10% critical strike chance."},{"t":"Critical strikes grant +25% critical damage per stack (max +50%, 5s)."},{"t":"+10% attack speed."},{"t":"+40% attack speed. -40% critical strike damage."},{"t":"+30% critical strike chance. -25% max HP."},{"t":"+20% cone breadth and +20% range."},{"t":"Converts damage to fire.","conv":"FIRE"}]},
 "greatsword_weapon":{"b":{"Detonation":{"t":["Shockwaves deal Explosive damage instead of Physical.","Explosive shockwaves grow larger and spread farther apart."],"conv":"EXPLOSIVE"},"Event Horizon":{"t":["Shockwaves deal Void damage instead of Physical.","Void shockwaves grow wider and overlap more densely."],"conv":"VOID"},"Fury":{"t":["Hits stack Relentless Strikes (max 3, 5s). Each stack reduces cooldown by 0.20s.","-20% cooldown.","Kills grant Rising Power: +10% damage per stack for 3s."]},"Guts":{"t":["5% chance to Heal 1 HP on hit.","Hitting 5+ enemies grants +30% damage reduction for 3s.","Kills grant +100% damage for 3s."]},"Shockwave":{"t":["Creates 1 additional shockwave.","Creates 1 additional shockwave.","Creates 1 additional shockwave."]},"Tremor":{"t":["Creates 1 additional shockwave.","Shockwaves grow larger.","Creates fewer shockwaves, but they hit harder and cover a larger area."]}},"s":[]},
 "icecube":{"b":{"Frozen Bastion":{"t":["Grants nearby allies a small fortify shield.","Allies in the area gain 30% reduced physical damage taken.","Fortify shields are 30% stronger, and Ice Cube fires freezing ice spheres on cast."]},"Eternal Winter":{"t":["+1.5s freeze duration, but -30% damage.","+30% area of effect.","Creates a frozen domain with extended duration that freezes all enemies inside."]},"Frostfire":{"t":["Converts to fire damage. Enemies are chilled and burned. Ice Cube radius is reduced by 30%.","Deals 100% more damage.","After 3 charges, unleash a delayed blastwave that damages and heavily knocks back nearby enemies."],"dot":1,"conv":"FIRE"}},"s":[{"t":"Reduces cooldown by 20%, but damage is reduced by 20%."},{"t":"Hitting an enemy has a 10% chance to spawn a tremor."},{"t":"Reduces enemy cold resistance by 30%, but increases their fire resistance by 30%."},{"t":"Increases radius by 20%."}]},
 "fortify":{"b":{"Aegis":{"t":["Increases shield strength by +25%.","Increases shield strength by +25%.","Increases shield strength by +25%."]},"Bulwark":{"t":["Increases pulse radius by +50%.","Reduces Fortify cooldown by 10%.","Increases pulse radius by +50% and reduces cooldown by 10%."]},"Frost Barrier":{"t":["Also applies Chill to enemies for 3s.","Freezes enemies for 3s. Freeze replaces Chill on hits.","Grants +50% Cold damage for 8s."]},"Lifeward":{"t":["Shielded players heal 5 HP over 5s.","Shielded players gain +20% healing received for 5s.","Shielded players receive a Healing Mark."]}},"s":[{"t":"Shields can now stack."}]},
 "bomb_blackhole":{"b":{"Implosion":{"t":["On collapse, triggers a Void implosion.","+100% damage over time.","Implosion deals +100% damage and gains massive knockback."],"dot":1},"Storm Singularity":{"t":["Shrinks into a storm-charged singularity and gains critical strike chance.","Has a 10% chance to trigger lightning.","Doubles stun time and empowers chain lightning to strike up to 3 enemies."]},"Wormhole Singularity":{"t":["On collapse, has a 50% chance to reopen at caster's location.","Reappeared wormholes last longer and pull enemies harder.","Reappeared wormholes deal more damage and have a 50% chance to reopen one final time."]}},"s":[{"t":"+200ms stun duration."},{"t":"-90% fuse timer. Detonates almost immediately after landing."},{"t":"+25% area of effect."},{"t":"On collapse, enemies take cold damage, are frozen for 1s, and chilled for 3s."}]},
 "drone":{"b":{"Heavy Payload":{"t":["Drone explosions grant nearby allies +8% heavy hit chance for 4s.","Nearby allies gain +8% heavy hit chance per active drone.","Heavy Payload buffs last 50% longer and grant +50% more heavy hit chance."]},"Overclock Swarm":{"t":["+1 drone in orbit.","Critical strikes grant 50% Drone cooldown reduction for 2s.","+1 drone and +10% critical strike chance."]},"Repulsor Cascade":{"t":["Drone explosions gain +20% knockback.","Every 5th drone explosion unleashes a massive repulsor blast.","Massive repulsor blasts are larger, hit harder, and launch enemies farther."]}},"s":[{"t":"Drone hits ignite enemies with a burning payload.","dot":1},{"t":"Converts Drone to COLD. Drone hits apply chill.","conv":"COLD"},{"t":"+1 drone in orbit."},{"t":"+1 drone in orbit. Drone -20% deploy time."},{"t":"+1 drone in orbit."},{"t":"Converts Drone damage to LIGHTNING.","conv":"LIGHTNING"}]},
 "machinegun":{"b":{"Field Medic":{"t":["Hits have a 2% chance to heal you for 3.","+50% fire rate.","+50% duration."]},"Incendiary Rounds":{"t":["+20% projectile speed, +20% rotation speed, and +20% duration.","+50% fire rate.","Micro explosions ignite enemies for a short burn."],"dot":1},"Shrapnel Core":{"t":["+1 micro explosion base impact and +20% AoE radius.","+10 crit chance. Crits grant +1% explosion radius for 3s.","Each hit grants micro explosions +0.1 crit chance for 2s."]}},"s":[{"t":"+40% micro explosion AoE radius."},{"t":"Bullets and micro explosions convert to COLD.","conv":"COLD"},{"t":"+25% crit chance."},{"t":"+100% crit damage."},{"t":"+50% fire rate."},{"t":"+50% fire rate. -80% damage for bullets and micro explosions."},{"t":"Crits grant +0.5% all resistances for 5s."},{"t":"Bullets and micro explosions convert to VOID.","conv":"VOID"}]},
 "chakram":{"b":{"Charged Blades":{"t":["Converts to lightning damage.","+20% lightning damage.","100% chance to trigger Chain Lightning on hit."],"conv":"LIGHTNING"},"Curved Stalker":{"t":["A curved chakram orbits from the left. +50% cooldown.","+30% speed. +25 crit strike chance.","A second curved chakram orbits from the right."]},"Phantom":{"t":["Fires an additional chakram in the opposite direction.","Catching a chakram grants +30% ethereal damage for 5s.","Fire 2 additional phantom chakrams that auto-aim toward enemies."]},"Trap Master":{"t":["Chakram transforms into a hovering trap (8s).","Trap applies DoT on hit.","-50% trap cooldown.","Trap explodes on impact, dealing AoE damage to nearby enemies.","A second trap is cast alongside the primary chakram."],"dot":1},"Void Chakram":{"t":["Converts to void damage. -10% physical resistance.","+20% void damage."],"conv":"VOID"}},"s":[{"t":"+40% throw range, +50% critical strike damage."},{"t":"-30% cooldown on catching a returning chakram."}]},
 "chain_lightning":{"b":{"Conductor":{"t":["+1 chain link and +25% range.","+25% chain-through damage.","+1 chain link and +25% chain-through damage."]},"Critical Surge":{"t":["+10% critical strike chance and +15 critical strike damage.","Each enemy hit grants +1% critical strike chance and +2 critical strike damage for 2s.","Critical hits have a 35% chance to trigger an electric explosion."]},"Storm Relay":{"t":["-20% cooldown, +25% range, +25% stun chance, and -20% damage.","Chain hits knock back enemies, +25% stun chance, and +0.5s stun duration.","If a cast hits 10 enemies, grant 20% elemental cooldown reduction for 3s. Also grants +25% stun chance and +1s stun duration."]}},"s":[{"t":"+1 chain link."},{"t":"Converts to fire damage with a blazing arc treatment.","conv":"FIRE"},{"t":"Converts to void damage with a purple arc treatment.","conv":"VOID"},{"t":"-20% cooldown."},{"t":"Fire +1 additional initial lightning bolt."}]},
 "kusarigama":{"b":{"Binding Chains":{"t":["Throws +1 additional scythe.","+25% spread width.","Hits have a 25% chance to stun enemies for 1s."]},"Momentum Reaper":{"t":["-20% chain length and -20% cooldown.","Killing 5 enemies with Kusarigama within 3s reduces its cooldown by 30% for 3s.","Enemy kills have a 10% chance to grant +8% critical strike chance for 5s, stacking up to 5 times. At max stacks, gain +100% critical strike chance for 3s."]},"Reaper's Edge":{"t":["-30% chain reach and +20% critical strike chance.","Enemy kills trigger a +40% critical damage buff for 3s.","+20% spread width, +20% scythe size, and +15% heavy hit chance."]}},"s":[{"t":"Converts to cold damage. Hits apply Chill to enemies.","conv":"COLD"},{"t":"Throws +1 scythe."},{"t":"Converts to lightning damage. -20% base damage, -20% cooldown, and hits have a 10% chance to release lightning.","conv":"LIGHTNING"}]},
 "minigun":{"b":{"Accelerator":{"t":["+50% fire rate.","+50% fire rate.","+50% fire rate."]},"Blaze":{"t":["Converts to fire damage. Applies Burn for 5s.","Burned enemies spread fire to nearby foes.","Gain +20% movement speed for 2s when Minigun starts firing."],"dot":1,"conv":"FIRE"},"Overdrive":{"t":["+50% duration.","+40% rotation speed.","+50% duration."]},"Shatterbelt":{"t":["Converts to explosive damage. Hits have a 35% chance to trigger unstable shell bursts.","Explosive shell bursts are larger and deal +20% damage.","Shell bursts have a 100% chance to trigger a heavier secondary detonation."],"conv":"EXPLOSIVE"},"Suppressive Fire":{"t":["Hits suppress enemies, reducing their physical resistance for 3s.","Suppressed enemies take more physical damage from all sources.","Hitting suppressed enemies can trigger a heavy physical burst."]},"Swarm":{"t":["A second minigun fires from the opposite side.","+100% fire rate.","+32px knockback."]}},"s":[{"t":"+50% duration."},{"t":"+75% fire rate. -25% damage."},{"t":"+50% knockback."},{"t":"+60% rotation speed."},{"t":"+50% knockback. -20% rotation speed."}]}
};
/* Stats the game never prints on a tooltip. trigger_ability_chance raises how
   often triggered effects fire, which is what makes a 1% proc worth carrying —
   and it is completely invisible in-game. */
const HIDDEN_STATS={
  /* Freeze Chance is one of FOUR stats a Legendary copy of this helm rolls three of
     — Crit Damage, Attack Speed, Physical Damage, Freeze Chance — so a given copy
     may not have it at all. What is reliable is that the tooltip never prints it
     when it is there: an observed Legendary showed two of its three rolls and
     silently omitted the third. Worded as a possibility, not a promise. */
  armor_t4_head_lunar_001:       "can roll +20% Freeze Chance, which the tooltip never prints",
  weapon_t4_sword_foundation_001:"+10% Trigger Ability Chance",
  weapon_t5_sword_virelda_001:   "+10% Trigger Ability Chance",
  /* Legendary-only, and read from live item data 2026-07-30. Every rare stat
     in that reading appeared at rarity 4 and never below it, so a lower-rarity
     copy of the same item genuinely does not have these. The tooltip prints
     none of them: Obsidian Clogs carry 100% Burn Chance and say nothing. */
  armor_t3_chest_lunar_001:             "+10% Lightning Power",
  armor_t3_chest_neotilus_001:          "+10% Explosive Power",
  armor_t3_feet_foundation_001:         "+10% Physical Resistance",
  armor_t3_feet_lunar_001:              "+10% Cold Power",
  armor_t3_head_foundation_001:         "+10% Shielding Power",
  armor_t3_head_lunar_001:              "+10% Fire Power",
  armor_t3_head_neotilus_001:           "+10% Void Power",
  armor_t4_feet_lunar_001:              "+20% Burn Chance",
  armor_t4_feet_neotilus_001:           "+100% Burn Chance",
  armor_t5_feet_neotilus_001:           "+1 Extra Projectiles",
  weapon_t4_staff_foundation_001:       "+10% Trigger Ability Chance",
  weapon_t4_sword_virelda_001:          "+10% Trigger Ability Chance",
  weapon_t6_staff_lunar_001:            "+8 Link Count",
};
/* Legendary effects as the community wiki documents them, read from each
   item's own page so the tier is implicit. For items we have recorded, this adds
   only the effect's NAME. For the rest it is all we have - and it carries no
   proc chance, because the wiki does not publish one and inventing it would
   be worse than saying nothing. */
const WIKI_FX={
 "weapon_t4_heavy_lunar_001":{"n":"Aftershock","d":"Repeated impacts release a bomb shockwave around you."},
 "weapon_t4_staff_lunar_001":{"n":"Void Resonance","d":"Critical strikes boost your void power for a short time."},
 "weapon_t3_staff_foundation_001":{"n":"Void Resonance","d":"Critical strikes boost your void power for a short time."},
 "armor_t5_chest_foundation_001":{"n":"Winter's Harvest","d":"Kills boost your cold power for a short time."},
 "armor_t5_feet_foundation_001":{"n":"Vital Spark","d":"Hits have a small chance to restore health."},
 "armor_t5_head_foundation_001":{"n":"Seismic Force","d":"Heavy hits boost your knockback for a short time."},
 "armor_t5_head_lunar_001":{"n":"Flame Nova","d":"Heavy hits erupt in a nova of fire around the target."},
 "armor_t5_chest_lunar_001":{"n":"Conductor","d":"Hits boost your lightning power for a short time."},
 "armor_t4_head_virelda_001":{"n":"Blast Bloom","d":"Critical strikes widen your explosion radius for a short time."},
 "armor_t4_chest_virelda_001":{"n":"Emberbrand","d":"Hits set enemies burning."},
 "armor_t4_feet_virelda_001":{"n":"Frostbite Edge","d":"Melee hits chill enemies, slowing them."},
 "armor_t5_chest_neotilus_001":{"n":"Drone Overdrive","d":"Critical strikes have a chance to overcharge your drone with explosive power."},
 "armor_t5_head_neotilus_001":{"n":"Sentry Salvo","d":"Kills deploy a miniature minigun that fires at nearby enemies."},
 "armor_t4_chest_neotilus_001":{"n":"Deadeye Momentum","d":"Critical strikes stack gun power for a short time."},
 "armor_t4_head_foundation_001":{"n":"Seismic Force","d":"Heavy hits boost your knockback for a short time."},
 "weapon_t4_heavy_neotilus_001":{"n":"Momentum Engine","d":"Heavy hits speed up your cooldowns for a short time."},
 "armor_t5_feet_virelda_001":{"n":"Momentum Engine","d":"Heavy hits speed up your cooldowns for a short time."},
 "armor_t5_head_virelda_001":{"n":"Emberbrand","d":"Hits set enemies burning."},
 "weapon_t5_greatsword_neotilus_001":{"n":"Frostbite Edge","d":"Melee hits chill enemies, slowing them."},
 "weapon_t5_staff_lunar_001":{"n":"Eruption Cycle","d":"Sustained pyrosphere hits trigger an eruption shockwave."},
 "weapon_t3_heavy_lunar_001":{"n":"Powder Keg","d":"Heavy hits boost your explosive power for a short time."},
 "weapon_t3_staff_lunar_001":{"n":"Kindled Fury","d":"Kills boost your fire power for a short time."},
 "weapon_t3_sword_virelda_001":{"n":"Winter's Harvest","d":"Kills boost your cold power for a short time."},
 "weapon_t6_greatsword_neotilus_001":{"n":"Echo Blade","d":"Greatsword swings are followed by a delayed phantom swing."},
 "weapon_t6_heavy_neotilus_001":{"n":"Momentum Engine","d":"Heavy hits speed up your cooldowns for a short time."},
 "weapon_t6_sword_foundation_001":{"n":"Bulwark Surge","d":"Casting has a 10% chance to fortify you, shielding incoming damage."},
 "weapon_t3_sword_foundation_001":{"n":"Conductor","d":"Hits boost your lightning power for a short time."},
 "weapon_t5_greatsword_virelda_001":{"n":"Chakram Cascade","d":"Sustained hits launch a spinning chakram at your target."},
 "armor_t6_chest_foundation_001":{"n":"Challenger's Aegis","d":"Fortifying grants physical power and draws enemy threat."},
 "armor_t6_feet_foundation_001":{"n":"Provoker's Edge","d":"Melee critical strikes generate extra threat."},
 "armor_t6_head_foundation_001":{"n":"Seismic Force","d":"Heavy hits boost your knockback for a short time."},
 "armor_t6_chest_lunar_001":{"n":"Flame Nova","d":"Heavy hits erupt in a nova of fire around the target."},
 "armor_t6_feet_lunar_001":{"n":"Aftershock","d":"Repeated impacts release a bomb shockwave around you."},
 "armor_t6_feet_neotilus_001":{"n":"Blast Bloom","d":"Critical strikes widen your explosion radius for a short time."},
 "armor_t6_chest_neotilus_001":{"n":"Drone Overdrive","d":"Critical strikes have a chance to overcharge your drone with explosive power."},
 "armor_t6_head_neotilus_001":{"n":"Sentry Salvo","d":"Kills deploy a miniature minigun that fires at nearby enemies."},
 "armor_t4_feet_foundation_001":{"n":"Guardian's Echo","d":"Shielding an ally boosts your shielding power."},
 "armor_t4_chest_foundation_001":{"n":"Vital Spark","d":"Hits have a small chance to restore health."},
 "weapon_t6_greatsword_virelda_001":{"n":"Frostbite Edge","d":"Melee hits chill enemies, slowing them."},
 "weapon_t6_sword_virelda_001":{"n":"Stormcall","d":"Casting has a 10% chance to unleash chain lightning at the nearest enemy."},
 "weapon_t4_greatsword_virelda_001":{"n":"Crushing Momentum","d":"Heavy hits and critical strikes boost your physical power for a short time."},
 "weapon_t4_greatsword_neotilus_001":{"n":"Provoker's Edge","d":"Melee critical strikes generate extra threat."},
 "armor_t5_chest_virelda_001":{"n":"Crushing Momentum","d":"Heavy hits and critical strikes boost your physical power for a short time."},
 "armor_t6_chest_virelda_001":{"n":"Chakram Cascade","d":"Sustained hits launch a spinning chakram at your target."},
 "armor_t6_feet_virelda_001":{"n":"Crushing Momentum","d":"Heavy hits and critical strikes boost your physical power for a short time."},
 "armor_t6_head_virelda_001":{"n":"Emberbrand","d":"Hits set enemies burning."},
 "weapon_t5_heavy_neotilus_001":{"n":"Aftershock","d":"Repeated impacts release a bomb shockwave around you."},
 "weapon_t5_heavy_lunar_001":{"n":"Provoker's Edge","d":"Melee critical strikes generate extra threat."},
 "weapon_t3_heavy_neotilus_001":{"n":"Seismic Force","d":"Heavy hits boost your knockback for a short time."},
 "weapon_t3_greatsword_neotilus_001":{"n":"Crushing Momentum","d":"Heavy hits and critical strikes boost your physical power for a short time."},
 "weapon_t3_greatsword_virelda_001":{"n":"Crushing Momentum","d":"Heavy hits and critical strikes boost your physical power for a short time."},
 "armor_t4_head_neotilus_001":{"n":"Conductor","d":"Hits boost your lightning power for a short time."}
};
/* What a hidden stat actually does, where that isn't self-evident. Trigger Ability
   Chance is the one worth explaining: it raises how often triggered effects fire,
   which is the difference between a 1% proc being a novelty and being a build. */
const HIDDEN_WHY={
  "Trigger Ability Chance":"Raises how often triggered effects fire — it's what makes a low-rate proc worth carrying.",
};
const SEC = {
  // The power_* family scales one damage type only, so a roll is worth nothing
  // unless you actually deal that type. trigger_ability_chance never appears on
  // an in-game tooltip at all.
  power_physical:"Physical Power %", power_fire:"Fire Power %", power_cold:"Cold Power %",
  power_void:"Void Power %", power_explosive:"Explosive Power %",
  power_healing:"Healing Power %", power_shielding:"Shielding Power %",
  power_lightning:"Lightning Power %", power_ethereal:"Ethereal Power %",
  resistance_stun:"Stun Resistance %",
  damage:"Damage", defense_rating:"Defense Rating %",
  resistance_physical:"Physical Resistance %", freeze_chance:"Freeze Chance %",
  trigger_ability_chance:"Trigger Ability Chance % (hidden in game)",
  attack_speed:"Attack Speed %", cooldown_reduction:"Cooldown Reduction %",
  critical_strike_chance:"Crit Chance %", critical_strike_damage:"Crit Damage %",
  heavy_hit_chance:"Heavy Hit Chance %", heavy_hit_damage:"Heavy Hit Damage %",
  dot_potency:"Dot Potency (flat)", dot_potency_pct:"Dot Potency %", dot_interval:"Dot Interval %", healing_power:"Healing Power %",
  buff_power:"Buff Power", shielding_power:"Shielding Power %", knockback:"Knockback",
  aoe_radius:"AoE Radius", duration:"Duration %", shots_per_tick:"Shots Per Tick %",
  projectile_count:"Extra Projectiles", catch_radius:"Catch Radius",
  link_count:"Link Count (flat)", link_count_pct:"Link Count %",
  physical_damage:"Physical DMG %", fire_damage:"Fire DMG %", cold_damage:"Cold DMG %",
  lightning_damage:"Lightning DMG %", void_damage:"Void DMG %", ethereal_damage:"Ethereal DMG %",
  explosive_damage:"Explosive DMG %", poison_damage:"Poison DMG %", health:"Max Health", health_regen:"Health Regen",
  max_energy:"Max Energy", movement_speed:"Speed %", dodge_chance:"Dodge %",
  damage_reduction:"Defense %", stun_resistance:"Stun Res %", poison_resistance:"Poison Res %", threat:"Threat",
};
const SECKEYS=Object.keys(SEC);
const SLOTS=["Arms","Head","Chest","Feet","Back","Neck","Ring 1","Ring 2","Belt"];
const SLOT_HINT={Arms:"your weapon"};
const ARMOUR=new Set(["Head","Chest","Feet"]);
const ACCESSORY=new Set(["Neck","Ring 1","Ring 2","Belt"]);
const SLOT_ALIAS={Weapon:"Arms",Torso:"Chest"};
const EXAMPLE={
 "loadout":["smg_gleamtwins","machinegun","pyrosphere","staff_weapon"],
 "gear":{"Arms":{"item":"Voltlite Staff","lv":22,"rolls":[{"s":"will","p":1,"v":7},{"s":"ferocity","p":1,"v":8},{"s":"focus","p":1,"v":7},{"s":"dot_potency","p":0,"v":28},{"s":"cooldown_reduction","p":0,"v":3.5}]},"Head":{"item":"Encoded Helm","lv":28,"rolls":[{"s":"vitality","p":1,"v":14},{"s":"precision","p":1,"v":7},{"s":"will","p":1,"v":7},{"s":"attack_speed","p":0,"v":5.5},{"s":"physical_damage","p":0,"v":5.5},{"s":"knockback","p":0,"v":22}]},"Chest":{"item":"Ferrox Plate Chest","lv":47,"rolls":[{"s":"vitality","p":1,"v":29},{"s":"precision","p":1,"v":9},{"s":"will","p":1,"v":9},{"s":"critical_strike_damage","p":0,"v":26},{"s":"attack_speed","p":0,"v":6.6},{"s":"physical_damage","p":0,"v":6.6}]},"Feet":{"item":"ChronoTehc Boots","lv":47,"rolls":[{"s":"vitality","p":1,"v":29},{"s":"will","p":1,"v":9},{"s":"focus","p":1,"v":9},{"s":"critical_strike_damage","p":0,"v":22},{"s":"healing_power","p":0,"v":22},{"s":"dot_potency","p":0,"v":22}]},"Back":{"item":"Wanderer's Encoded Cloak","lv":4,"rolls":[{"s":"will","p":1,"v":2},{"s":"focus","p":1,"v":2}]},"Neck":{"item":"Gunner's Pendant","lv":0,"rolls":[{"s":"duration","p":0,"v":50,"t":"gun"}]},"Ring 1":{"item":"Double Tap Ring","lv":0,"rolls":[{"s":"shots_per_tick","p":0,"v":100,"t":"gun"},{"s":"attack_speed","p":0,"v":3.25},{"s":"cooldown_reduction","p":0,"v":1.5},{"s":"dot_potency","p":0,"v":13}]},"Ring 2":{"item":"Pyrosphere Ring","lv":0,"rolls":[{"s":"projectile_count","p":0,"v":1,"t":"pyrosphere"},{"s":"critical_strike_chance","p":0,"v":3.5},{"s":"critical_strike_damage","p":0,"v":14},{"s":"attack_speed","p":0,"v":3.5}]},"Belt":{"item":"Nihil Cinch","lv":0,"rolls":[{"s":"void_damage","p":0,"v":20},{"s":"aoe_radius","p":0,"v":3.5},{"s":"critical_strike_damage","p":0,"v":12}]}},
 "compare":{"slot":"Chest","item":"Legendary chest (iLvl 64)","rolls":[{"s":"vitality","p":1,"v":40},{"s":"power","p":1,"v":12},{"s":"ferocity","p":1,"v":12},{"s":"critical_strike_chance","p":0,"v":7.2},{"s":"critical_strike_damage","p":0,"v":31}]}
};
/* ═══════════ STATE + SHARE LINKS ═══════════ */
const LS="sb_planner_v3";
const LS_OPEN="sb_planner_open_slot";
const ALLSTATS=AKEYS.concat(SECKEYS);
/* What the build is actually leaning on, read off the gear rather than guessed.
   Each theme keeps the evidence that raised it so the advice can say why, and a
   theme nobody has invested in never fires. */
const RELIC_THEMES=[
  {k:"dot",      name:"damage over time", stats:["dot_potency","dot_potency_pct","dot_interval"],
   want:/\b(burn|burns|burning|ignite|ignites|scorch|damage over time|\bdot\b)/i,
   anti:/(burn|fire dot|dot)[^.]*(shorter|last -)/i,
   antiWhy:"shortens your burns, and damage over time is what this build runs on"},
  {k:"crit",     name:"critical strikes", stats:["critical_strike_chance","critical_strike_damage"],
   want:/\bcrit(ical)?\b/i, anti:/-\d+%?\s*crit/i,
   antiWhy:"cuts critical strikes, which your gear leans on"},
  {k:"aoe",      name:"area of effect", stats:["aoe_radius"],
   want:/\b(aoe|area of effect|radius|blast radius)\b/i, anti:/-\d+%\s*(aoe|area of effect)/i,
   antiWhy:"shrinks your area of effect, which your gear pays for"},
  {k:"cooldown", name:"cooldown reduction", stats:["cooldown_reduction"],
   want:/\bcooldown\b/i,
   // "+10% cooldown reduction" is a gain; "+100% cooldown" is the penalty. That
   // negative lookahead is the entire difference between the two.
   anti:/\+\d+%\s*cooldown\b(?!\s*reduction)/i,
   antiWhy:"raises your cooldown, and you have paid for cooldown reduction"},
  {k:"heavy",    name:"heavy hits", stats:["heavy_hit_chance","heavy_hit_damage"],
   want:/\bheavy hit/i},
  {k:"speed",    name:"attack speed", stats:["attack_speed"],
   want:/\b(fire rate|attack speed|rotation speed)\b/i},
  {k:"duration", name:"effect duration", stats:["duration"], want:/\bduration\b/i},
];
/* Elements are treated the same way, but they also matter when a relic CONVERTS to
   them: converting to an element you have no gear for throws that gear away. */
const RELIC_ELEMENTS=[
  // "fire rate" is attack speed, not fire damage. Without the lookahead every
  // fire-rate relic in the game reads as a fire-build recommendation.
  {k:"FIRE",     stats:["power_fire","fire_damage"],
   want:/\bfire(?!\s*rate)\b|burn|ignite|incendiar|blaz/i,
   anti:/increases their fire resistance/i,
   antiWhy:"raises enemy FIRE resistance, working against your own damage"},
  {k:"COLD",     stats:["power_cold","cold_damage"],           want:/\bcold|chill|freeze|frost/i},
  {k:"VOID",     stats:["power_void","void_damage"],           want:/\bvoid\b/i},
  {k:"LIGHTNING",stats:["power_lightning","lightning_damage"], want:/\blightning|electro|storm/i},
  {k:"PHYSICAL", stats:["power_physical","physical_damage"],   want:/\bphysical\b/i},
  {k:"EXPLOSIVE",stats:["power_explosive","explosive_damage"], want:/\bexplosi|shell burst|micro explosion/i},
];
/* ---- quick entry: type or paste tooltip lines instead of using dropdowns ----
   Screenshot OCR is library-first: name → GEAR_LIB for fixed rolls (digits on the
   pixel font are unreliable), then only the random secondaries come from OCR. */
const STAT_ALIASES = (()=>{
  const m={};
  AKEYS.forEach(k=>{ m[k]=k; });
  m.pow="power"; m.prec="precision"; m.fero="ferocity"; m.vit="vitality"; m.foc="focus";
  Object.entries(SEC).forEach(([k,label])=>{
    const clean=label.toLowerCase().replace(/\s*%$/,"").replace(/[()]/g,"").trim();
    m[clean]=k;
  });
  Object.assign(m,{
    "crit damage":"critical_strike_damage", "crit dmg":"critical_strike_damage", csd:"critical_strike_damage",
    "crit chance":"critical_strike_chance", csc:"critical_strike_chance",
    "critical strike damage":"critical_strike_damage", "critical strike chance":"critical_strike_chance",
    "heavy hit chance":"heavy_hit_chance", hhc:"heavy_hit_chance",
    "heavy hit damage":"heavy_hit_damage", hhd:"heavy_hit_damage",
    pracision:"precision", pricision:"precision",
    ljill:"will", jill:"will", lil:"will", witality:"vitality", yitality:"vitality",
    "qos radius":"aoe_radius", qos:"aoe_radius", "our ation":"duration", ouration:"duration",
    "attack speed":"attack_speed", "atk speed":"attack_speed", as:"attack_speed",
    "cooldown reduction":"cooldown_reduction", cdr:"cooldown_reduction", cooldown:"cooldown_reduction",
    "cooldown raduction":"cooldown_reduction", raduction:"cooldown_reduction",
    "healing power":"healing_power", "healing pwr":"healing_power",
    "haaling power":"healing_power", haaling:"healing_power",
    "shielding power":"shielding_power", "shield pwr":"shielding_power",
    "health regeneration":"health_regen", "health regen":"health_regen", "hp regen":"health_regen",
    "max health":"health", "max hp":"health", hp:"health",
    "aoe radius":"aoe_radius", aoe:"aoe_radius",
    "dot potency":"dot_potency", "oot potency":"dot_potency", oot:"dot_potency",
    "physical damage":"physical_damage", "physical dmg":"physical_damage",
    "void damage":"void_damage", "void dmg":"void_damage", "fire damage":"fire_damage",
    "cold damage":"cold_damage", "lightning damage":"lightning_damage",
    "poison damage":"poison_damage", "explosive damage":"explosive_damage",
    "ethereal damage":"ethereal_damage", "dodge chance":"dodge_chance", dodge:"dodge_chance",
    "defense rating":"damage_reduction", defense:"damage_reduction",
    "stun resistance":"stun_resistance", "shots per tick":"shots_per_tick",
    "extra projectiles":"projectile_count", "extra projectile":"projectile_count",
    "additional projectile":"projectile_count", "additional projectiles":"projectile_count",
    projectiles:"projectile_count", projectile:"projectile_count",
    "link count":"link_count", "link count flat":"link_count",
    knockback:"knockback",
  });
  return m;
})();
/* Observed secondary/primary magnitudes from documented tooltips — used to spot
   OCR digit errors (e.g. "%"" read as 4 → +12% becomes +124). */
const ROLL_BOUNDS=(()=>{
  const m={};
  GEAR_LIB.forEach(g=>(g.rolls||[]).forEach(r=>{
    if(!r||!r.s || r.v==null || isNaN(+r.v)) return;
    const v=+r.v;
    if(!m[r.s]) m[r.s]={min:v,max:v,n:1};
    else{ m[r.s].min=Math.min(m[r.s].min,v); m[r.s].max=Math.max(m[r.s].max,v); m[r.s].n++; }
  }));
  return m;
})();
const RARITY_RE=/^(legendary|epic|rare|uncommon|common)\b/i;
const SLOT_FROM_TIP={
  arms:"Arms", weapon:"Arms", staff:"Arms", hammer:"Arms", sword:"Arms", katana:"Arms", greatsword:"Arms",
  head:"Head", helm:"Head", crown:"Head", visor:"Head",
  chest:"Chest", torso:"Chest", cuirass:"Chest", coat:"Chest", plate:"Chest",
  feet:"Feet", boots:"Feet", greaves:"Feet", legguards:"Feet",
  back:"Back", cloak:"Back", cape:"Back",
  neck:"Neck", pendant:"Neck", amulet:"Neck",
  ring:"Ring 1", belt:"Belt", girdle:"Belt", cinch:"Belt",
};
/* Screenshot matching used to search GEAR_LIB alone - 41 items whose exact rolls
   came off real tooltips. The item database knows 171, so anything documented only
   there could never be matched however cleanly it read: paste a Tritanium Elemental
   Pendant and the importer says "not in the item database" while the database is
   showing it two panels away.

   ITEM_DB entries are reshaped to look like library ones so the four matchers below
   need no changes. Their fixed rolls are the primaries plus the base secondaries an
   item always carries - a Lunar Conduit Robe is always Cooldown Reduction, AoE
   Radius and DoT Potency on top of its three attributes - and rolledSec is the real
   bonus-pick count for the rarity, so the rest genuinely comes from the image.

   GEAR_LIB is listed first and wins ties, so a hand-verified entry always beats a
   generated one, and names already in GEAR_LIB are never duplicated. Those entries
   borrow the pick counts but NOT the base values: their rolls were read off real
   tooltips, sometimes at a different item level, so a base value from the database
   would not match the copy they describe. */
const ID_SLOT={chest:"Chest",head:"Head",feet:"Feet",back:"Back",necklace:"Neck",
               neck:"Neck",belt:"Belt",ring:"Ring 1"};
const RARITY_NAME=["common","uncommon","rare","epic","legendary"];
/* The name is the worst-OCR'd line on a tooltip - short, pixel font, rarity
   colour, and exactly where other UI bleeds into a crop. Flavour text is the
   best: ~95 characters of prose below the stats, where nothing overlaps it, and
   long enough that a few misread glyphs stop mattering. A real paste whose name
   read as "Leweal H er" had flavour good enough to identify the item outright.

   Scored on distinctive words rather than edit distance: a mangled word simply
   fails to count instead of dragging the whole string down. Eight groups share
   wording - every Tier 5 belt says "Found in Volatile dungeon chests" - so a tie
   returns null rather than picking one. */
const FLAVOUR_STOP=new Set(["that","this","with","from","your","when","have","been","into","over",
  "found","forged","chests","dungeon","station","pattern","piece","made","also","they","their"]);
/* Some tooltip lines print without the ability they apply to. "+1 additional
   projectile" is the known case: a developer confirmed it is Drone only and that
   the description failing to say so is the bug. Items that scope it elsewhere
   still carry an explicit tag - the Pyrosphere Ring does - so only fill in the
   blank when the game left one. */
const IMPLIED_TAG={projectile_count:"drone"};
const OCR_WHITELIST="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+%-.:'[] ";
const OCR_DIGIT_WHITELIST="0123456789+.%: ";
/* ---- the honest tooltip -------------------------------------------------
   Soulbound's own tooltip omits things: some items carry stats it never prints
   (trigger_ability_chance, freeze_chance) and every Legendary effect is reduced
   to a bare [Tag] line or nothing at all. This renders the item the way the game
   does, then adds the part the game leaves out.

   Lookup is EXACT on the item's name (case and spacing normalised) and nothing
   else. No fuzzy matching, no prefix matching: attaching one item's hidden effect
   to a similarly-named item would be worse than saying nothing, because the whole
   value of this panel is that you can trust what it prints. */
const HIDDEN_INDEX=(()=>{
  const ix={}, key=s=>String(s).toLowerCase().replace(/\s+/g," ").trim();
  const put=(n,patch)=>{ if(!n) return; const k=key(n); ix[k]=Object.assign(ix[k]||{},patch); };
  Object.entries(ITEM_NAMES).forEach(([id,disp])=>{
    put(disp,{id,display:disp,stat:HIDDEN_STATS[id]||null});
    put(id,  {id,display:disp,stat:HIDDEN_STATS[id]||null});
  });
  Object.entries(HIDDEN_STATS).forEach(([id,stat])=>put(id,{id,stat}));
  // Documented gear is "known" — with or without a hidden effect — so the tooltip
  // never says "hasn't been recorded" for a library item.
  GEAR_LIB.forEach(g=>{
    put(g.name, g.fx ? {display:g.name, fx:g.fx} : {display:g.name});
  });
  /* A display name can cover two tiers with genuinely different effects: the
     Emberline Belt buffs fire on a kill at t5 and on an Elemental cast at t6.
     Object.assign kept only the last row read, which made the card assert one
     tier's effect for the other. Every variant is kept so the card can say so. */
  const putProc=(n,p)=>{ if(!n) return; const k=key(n); const e=(ix[k]=ix[k]||{});
    e.procs=e.procs||[]; if(!e.procs.includes(p)) e.procs.push(p); e.proc=e.procs[0]; };
  PROCS.forEach(p=>{ put(p.name,{display:p.name}); putProc(p.name,p); putProc(p.pat,p); });
  return ix;
})();
/* How many random secondaries a copy of this item rolls.

   Prefer the recorded count. The ladder below assumed rarity and bonus count rise
   together, which is wrong: of the 76 items documented at both, 58 give FEWER
   bonus stats on Legendary than on Epic - usually two against three - because the
   legendary package spends a slot on the effect itself. The ladder survives only
   as a fallback for items with nothing recorded. */
const RARITY_RANK={common:0, uncommon:1, rare:2, epic:3, legendary:4};
