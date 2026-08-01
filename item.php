<?php
/**
 * Arcadia item pages.
 *
 *   /item/<slug>   one page per item NAME, showing every tier it covers
 *   /items         the index
 *
 * These exist because the planner keeps everything it knows in JavaScript on a
 * single URL, so a search for an item name could never reach it. The data is
 * authored in index.html exactly as before; tools/export_items.py dumps it to
 * items.json and this renders that. Nothing is maintained twice.
 *
 * One page per name rather than per id: eighteen names cover both a Tier 5 and
 * a Tier 6 item, people search the name, and two pages would compete for the
 * same query while neither could say the tiers differ. Here they sit together.
 */

declare(strict_types=1);

const DATA = __DIR__ . '/items.json';
const SITE = 'https://arcadia.carl-prewitt.com';

$raw = @file_get_contents(DATA);
if ($raw === false) {
    http_response_code(503);
    header('Content-Type: text/html; charset=utf-8');
    exit('<h1>Item data unavailable</h1><p><a href="/">Back to the planner</a></p>');
}
$DB = json_decode($raw, true);
$ITEMS = $DB['items'] ?? [];
$SEC = $DB['labels']['sec'] ?? [];
$ATTR = $DB['labels']['attrs'] ?? [];

function e(?string $s): string {
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Secondary keys read like power_fire; fall back to a readable form. */
function statLabel(string $k): string {
    global $SEC;
    return $SEC[$k] ?? ucfirst(str_replace('_', ' ', $k));
}

function attrLabel(string $k): string {
    global $ATTR;
    return $ATTR[$k] ?? ucfirst($k);
}

function num(float $n): string {
    return rtrim(rtrim(number_format($n, 2, '.', ''), '0'), '.');
}

$slug = (string) ($_GET['slug'] ?? '');
$item = null;
if ($slug !== '') {
    foreach ($ITEMS as $i) {
        if (($i['slug'] ?? '') === $slug) { $item = $i; break; }
    }
    if ($item === null) {
        http_response_code(404);
    }
}

/* ---------------------------------------------------------------- head --- */
$isIndex = ($slug === '');
if ($item) {
    $tiers = array_values(array_filter(array_map(fn($v) => $v['tier'] ?? null, $item['variants'])));
    $tierTxt = $tiers ? ('Tier ' . implode(' and Tier ', array_unique($tiers))) : '';
    $title = $item['name'] . ' — ' . $item['slot'] . ' — Soulbound: Online | Arcadia';
    $descBits = [$item['name'], 'is a', strtolower($item['slot']), 'in Soulbound: Online.'];
    foreach ($item['variants'] as $v) {
        if (!empty($v['effect']['text'])) {
            $descBits[] = 'Legendary effect: ' . $v['effect']['text'] . '.';
            break;
        }
    }
    if (!empty($item['tiersDiffer'])) $descBits[] = 'Its Tier 5 and Tier 6 effects are different.';
    $desc = implode(' ', $descBits);
    $canon = SITE . '/item/' . $item['slug'];
} elseif ($isIndex) {
    $title = 'Item database — every measured item in Soulbound: Online | Arcadia';
    $desc = 'Stats, possible rolls, drop sources and the legendary effects the in-game '
          . 'tooltip does not print, for ' . count($ITEMS) . ' items in Soulbound: Online.';
    $canon = SITE . '/items';
} else {
    $title = 'Item not found | Arcadia';
    $desc = 'That item is not in the database.';
    $canon = SITE . '/items';
}
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=1800');
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= e($title) ?></title>
<meta name="description" content="<?= e($desc) ?>">
<link rel="canonical" href="<?= e($canon) ?>">
<meta property="og:type" content="website">
<meta property="og:title" content="<?= e($item ? $item['name'] . ' — Arcadia' : $title) ?>">
<meta property="og:description" content="<?= e($desc) ?>">
<meta property="og:url" content="<?= e($canon) ?>">
<meta property="og:image" content="<?= SITE ?>/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?= e($item ? $item['name'] . ' — Arcadia' : $title) ?>">
<meta name="twitter:description" content="<?= e($desc) ?>">
<meta name="twitter:image" content="<?= SITE ?>/og.jpg">
<?php if (!$item && !$isIndex): ?><meta name="robots" content="noindex,follow"><?php endif; ?>
<style>
/* Self-hosted, same two faces the planner uses. No third-party request: the
   site's own policy blocks outside origins, and a font host would otherwise be
   the only outbound call on the page. Karla is one variable font covering both
   weights, so it is declared once over a range rather than twice. */
@font-face{font-family:'Karla';src:url(/fonts/karla.woff2) format('woff2');
  font-weight:400 700;font-style:normal;font-display:swap}
@font-face{font-family:'Silkscreen';src:url(/fonts/silkscreen.woff2) format('woff2');
  font-weight:400;font-style:normal;font-display:swap}
:root{
  --void:#0D0A11; --panel:#1B1520; --panel2:#241C2A;
  --edge:#3A2C42; --amber:#E8913A; --amber-dim:#8A5A2C; --amber-ink:#F0A253;
  --ink:#F0E9E2; --dim:#B3A9B8; --faint:#8B8290;
  --cyan:#6FB8DC; --green:#77C25A; --gold:#E8C24A;
  --pixel:"Silkscreen","Courier New",monospace;
  --sans:"Karla",system-ui,-apple-system,sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:var(--void);color:var(--ink);font-family:var(--sans);
  font-size:15px;line-height:1.6;-webkit-text-size-adjust:100%}
a{color:var(--amber-ink)}
a:focus-visible,button:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
.wrap{max-width:860px;margin:0 auto;padding:20px 16px 64px}
header.top{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;
  padding-bottom:14px;border-bottom:1px solid var(--edge);margin-bottom:20px}
header.top .logo{font-family:var(--pixel);font-size:20px;color:var(--amber);text-decoration:none}
header.top .tag{font-size:12.5px;color:var(--faint)}
nav.crumb{font-size:12.5px;color:var(--faint);margin-bottom:14px}
nav.crumb a{color:var(--dim);text-decoration:none}
nav.crumb a:hover{color:var(--amber-ink);text-decoration:underline}
h1{font-family:var(--pixel);font-size:26px;line-height:1.3;color:var(--amber);margin:0 0 4px}
.sub{font-size:13px;color:var(--amber-ink);opacity:.9;margin-bottom:22px}
h2{font-family:var(--pixel);font-size:15px;color:var(--ink);margin:30px 0 10px}
/* The card is the in-game tooltip, at full size, with the section the game omits. */
.cards{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(290px,1fr))}
.tt{background:#150F1A;border:1px solid var(--amber);padding:13px 15px 14px;
  box-shadow:0 10px 26px rgba(0,0,0,.5)}
.ttname{font-family:var(--pixel);font-size:15px;color:var(--amber);line-height:1.35}
.ttsub{font-size:12px;color:var(--amber-ink);opacity:.85;margin-bottom:9px}
.tthead{font-size:12.5px;font-weight:700;color:var(--ink);margin:11px 0 3px}
.tthead.dim{color:var(--faint)}
.ttrow{display:flex;gap:9px;align-items:baseline;font-size:13.5px;line-height:1.55}
.ttv{color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.ttl{color:var(--cyan)}
.ttrule{height:1px;background:var(--amber-dim);margin:13px -15px 0;opacity:.65}
.ttnote{font-size:12px;color:var(--faint);line-height:1.55;margin-top:4px}
.fx .ttv{color:var(--green)}
.warn{border:1px solid var(--gold);background:rgba(232,194,74,.07);
  padding:11px 14px;margin:18px 0;font-size:13.5px;color:var(--ink)}
.warn b{color:var(--gold)}
.meta{font-size:13.5px;color:var(--dim)}
.meta dt{font-weight:700;color:var(--ink);margin-top:10px;font-size:12.5px}
.meta dd{margin:1px 0 0}
.flav{font-style:italic;color:var(--faint);font-size:13.5px;
  border-left:2px solid var(--edge);padding-left:12px;margin:14px 0}
.cta{display:inline-block;margin-top:8px;background:var(--amber);color:#1a1208;
  font-weight:700;text-decoration:none;padding:10px 16px;font-size:14px}
.cta:hover{background:var(--amber-ink)}
.idx{columns:2;column-gap:26px}
.idx a{display:block;padding:3px 0;text-decoration:none;font-size:14px;
  break-inside:avoid;color:var(--dim)}
.idx a:hover{color:var(--amber-ink)}
.idx a .b{color:var(--green);font-size:11px}
.grp{margin-bottom:22px}
.grp h3{font-family:var(--pixel);font-size:13px;color:var(--faint);
  margin:0 0 6px;column-span:all}
footer{margin-top:44px;padding-top:16px;border-top:1px solid var(--edge);
  font-size:12px;color:var(--faint);line-height:1.65}
footer a{color:var(--dim)}
@media (max-width:560px){ .idx{columns:1} h1{font-size:21px} .wrap{padding:16px 13px 48px} }
</style>
</head>
<body>
<div class="wrap">
<header class="top">
  <a class="logo" href="/">Arcadia</a>
  <span class="tag">build planner for Soulbound: Online</span>
</header>

<?php if ($item): ?>
<nav class="crumb"><a href="/">Planner</a> &rsaquo; <a href="/items">Items</a> &rsaquo; <?= e($item['name']) ?></nav>
<h1><?= e($item['name']) ?></h1>
<div class="sub"><?= e($item['slot']) ?><?= $tierTxt ? ' &middot; ' . e($tierTxt) : '' ?></div>

<?php if (!empty($item['tiersDiffer'])): ?>
<div class="warn"><b>These tiers are not the same item.</b>
  The Tier 5 and Tier 6 versions share a name but their legendary effects differ,
  and the game gives you no way to tell them apart from the name alone. Check the
  item level in game against the cards below.</div>
<?php endif; ?>

<div class="cards">
<?php foreach ($item['variants'] as $v):
    $eff = $v['effect'] ?? null; ?>
  <div class="tt">
    <div class="ttname"><?= e($item['name']) ?></div>
    <div class="ttsub"><?= e($item['slot']) ?><?php
      if (!empty($v['tier'])) echo ' &middot; Tier ' . (int) $v['tier'];
      if (!empty($v['level'])) echo ' &middot; Level ' . (int) $v['level'];
    ?></div>

    <?php if (!empty($v['primaries'])): ?>
      <div class="tthead">Primary</div>
      <?php foreach ($v['primaries'] as $k => $val): ?>
        <div class="ttrow"><span class="ttv">+<?= e(num((float) $val)) ?></span><span class="ttl"><?= e(attrLabel($k)) ?></span></div>
      <?php endforeach; ?>
    <?php endif; ?>

    <?php if (!empty($v['base'])): ?>
      <div class="tthead">Base</div>
      <?php foreach ($v['base'] as $k => $val): ?>
        <div class="ttrow"><span class="ttv"><?= e(num((float) $val)) ?></span><span class="ttl"><?= e(statLabel((string) $k)) ?></span></div>
      <?php endforeach; ?>
    <?php endif; ?>

    <?php if (!empty($v['secondaries'])): ?>
      <div class="tthead">Can roll</div>
      <?php foreach ($v['secondaries'] as $k): ?>
        <div class="ttrow"><span class="ttl"><?= e(statLabel((string) $k)) ?></span></div>
      <?php endforeach; ?>
    <?php endif; ?>

    <div class="ttrule"></div>
    <?php if ($eff || !empty($v['hidden'])): ?>
      <div class="tthead">Not on the in-game tooltip</div>
      <?php if (!empty($v['hidden'])): ?>
        <div class="ttrow"><span class="ttv"><?= e($v['hidden']) ?></span></div>
        <?php if (!empty($v['hiddenWhy'])): ?><div class="ttnote"><?= e($v['hiddenWhy']) ?></div><?php endif; ?>
      <?php endif; ?>
      <?php if ($eff): ?>
        <div class="ttrow fx">
          <span class="ttv"><?= e($eff['trigger'] ?: 'effect') ?></span>
          <span class="ttl"><?= e($eff['text']) ?><?php
            if (!empty($eff['scopeLabel'])) echo ' [' . e($eff['scopeLabel']) . ']';
            if (isset($eff['chance']) && $eff['chance'] !== null) echo ' &middot; ' . (int) $eff['chance'] . '%';
          ?></span>
        </div>
        <div class="ttnote"><?= !empty($eff['source']) && $eff['source'] === 'wiki'
          ? 'Recorded on the community wiki; the trigger rate is not published.'
          : 'Only a Legendary copy carries this. A lower-rarity one of the same item has nothing.' ?></div>
      <?php endif; ?>
    <?php else: ?>
      <div class="tthead dim">Not on the in-game tooltip</div>
      <div class="ttnote">Nothing hidden has been recorded for this one.</div>
    <?php endif; ?>
  </div>
<?php endforeach; ?>
</div>

<?php
$dropped = array_values(array_filter($item['variants'], fn($v) => !empty($v['drop']) || !empty($v['flavour'])));
if ($dropped): ?>
<h2>Where it comes from</h2>
<dl class="meta">
<?php foreach ($dropped as $v): ?>
  <?php if (!empty($v['flavour'])): ?>
    <div class="flav"><?= e($v['flavour']) ?></div>
  <?php endif; ?>
  <?php if (!empty($v['drop'])): ?>
    <dt><?= !empty($v['tier']) ? 'Tier ' . (int) $v['tier'] : 'Drop' ?></dt>
    <dd><?= e(trim(preg_replace('/(?<!^)[A-Z]/', ' $0', str_replace('_', ' ', (string) $v['drop']['table'])))) ?>
        &middot; about <?= e(num(((float) $v['drop']['chance']) * 100)) ?>% per roll</dd>
  <?php endif; ?>
<?php endforeach; ?>
</dl>
<?php endif; ?>

<h2>Use it in a build</h2>
<p class="meta">The planner works out what this item is actually worth to the abilities
you run &mdash; which attributes it feeds, whether its tagged rolls match anything you
have equipped, and how it compares against what is in that slot now.</p>
<a class="cta" href="/">Open the build planner</a>

<script type="application/ld+json"><?= json_encode([
  '@context' => 'https://schema.org',
  '@type' => 'ItemPage',
  'name' => $item['name'],
  'url' => $canon,
  'description' => $desc,
  'isPartOf' => ['@type' => 'WebSite', 'name' => 'Arcadia', 'url' => SITE],
  'about' => ['@type' => 'Thing', 'name' => $item['name'],
              'description' => $item['slot'] . ' in the video game Soulbound: Online'],
  'breadcrumb' => ['@type' => 'BreadcrumbList', 'itemListElement' => [
      ['@type' => 'ListItem', 'position' => 1, 'name' => 'Items', 'item' => SITE . '/items'],
      ['@type' => 'ListItem', 'position' => 2, 'name' => $item['name'], 'item' => $canon],
  ]],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?></script>

<?php elseif ($isIndex):
  $groups = [];
  foreach ($ITEMS as $i) { $groups[$i['slot'] ?: 'Gear'][] = $i; }
  ksort($groups); ?>
<nav class="crumb"><a href="/">Planner</a> &rsaquo; Items</nav>
<h1>Item database</h1>
<div class="sub"><?= count($ITEMS) ?> items &middot; stats, possible rolls, drop sources,
  and the legendary effects the game does not print</div>
<p class="meta">Values are community-measured and can change with any game update.
  A green dot marks an item with a recorded legendary effect.</p>
<?php foreach ($groups as $slot => $list): ?>
  <div class="grp">
    <h3><?= e((string) $slot) ?> &middot; <?= count($list) ?></h3>
    <div class="idx">
    <?php foreach ($list as $i): ?>
      <a href="/item/<?= e($i['slug']) ?>"><?= e($i['name']) ?><?php
        if (!empty($i['hasEffect'])) echo ' <span class="b">&#9679;</span>'; ?></a>
    <?php endforeach; ?>
    </div>
  </div>
<?php endforeach; ?>

<?php else: ?>
<nav class="crumb"><a href="/">Planner</a> &rsaquo; <a href="/items">Items</a></nav>
<h1>Not found</h1>
<p class="meta">There is no item at that address. It may have been renamed in a patch.</p>
<a class="cta" href="/items">Browse every item</a>
<?php endif; ?>

<footer>
  <b>This project is an independent creation and is not affiliated with, endorsed, or
  sponsored by Soulbound.</b> View the official Fan Content Policy at
  <a href="https://soulbound.game/legal-portal/fan-content" rel="noopener">soulbound.game/legal-portal/fan-content</a>.
  <br><br>All game names and trademarks belong to their respective owners. Values are
  community-maintained approximations that can change with game updates &mdash; always
  trust your in-game stat panel over this tool.
  <a href="https://github.com/rages4calm/arcadia" rel="noopener">Source on GitHub</a>.
</footer>
</div>
</body>
</html>
