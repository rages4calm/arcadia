<?php
/**
 * Arcadia relic pages.
 *
 *   /relics          the index: every ability and its pool
 *   /relic/<slug>    one ability's full pool
 *
 * Organised by ability because that is how the game hands relics out: which
 * pool a run offers depends on what you have equipped. So "the relics for
 * Pyrosphere" is the thing a player actually looks for, and it is also what
 * they search.
 *
 * Two shapes. A FAMILY is a named relic with an upgrade path -- take it again
 * and it improves, one line per tier in order. A STANDALONE is a single relic
 * with no path. The distinction matters when planning a run, so the page keeps
 * them visually separate rather than flattening them into one list.
 *
 * Data comes from relics.json, exported from the same consts in data.js that
 * the planner reads. Nothing is maintained twice: the JSON is build output, so
 * corrections belong in data.js.
 */

declare(strict_types=1);

const DATA = __DIR__ . '/relics.json';
const SITE = 'https://arcadia.carl-prewitt.com';

$raw = @file_get_contents(DATA);
if ($raw === false) {
    http_response_code(503);
    header('Content-Type: text/html; charset=utf-8');
    exit('<h1>Relic data unavailable</h1><p><a href="/">Back to the planner</a></p>');
}
$DB = json_decode($raw, true);
$POOLS = $DB['relics'] ?? [];
$ATTR = $DB['attrs'] ?? [];

function e(?string $s): string {
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function attrLabel(string $k): string {
    global $ATTR;
    return $ATTR[$k] ?? ucfirst($k);
}

/** Roman numerals for the upgrade steps; no pool goes past a handful. */
function roman(int $n): string {
    $map = [1 => 'I', 2 => 'II', 3 => 'III', 4 => 'IV', 5 => 'V', 6 => 'VI', 7 => 'VII'];
    return $map[$n] ?? (string) $n;
}

$slug = (string) ($_GET['slug'] ?? '');
$pool = null;
if ($slug !== '') {
    foreach ($POOLS as $p) {
        if (($p['slug'] ?? '') === $slug) { $pool = $p; break; }
    }
    if ($pool === null) http_response_code(404);
}

$isIndex = ($slug === '');
$totalRelics = array_sum(array_map(fn($p) => (int) ($p['count'] ?? 0), $POOLS));

if ($pool) {
    $title = $pool['ability'] . ' relics — Soulbound: Online | Arcadia';
    $desc = 'All ' . (int) $pool['count'] . ' relics offered to '
          . $pool['ability'] . ' in Soulbound: Online, with every upgrade tier.';
    $canon = SITE . '/relic/' . $pool['slug'];
} elseif ($isIndex) {
    $title = 'Relic database — every relic in Soulbound: Online | Arcadia';
    $desc = $totalRelics . ' relics across ' . count($POOLS) . ' abilities in '
          . 'Soulbound: Online, grouped by the ability that unlocks them, with every upgrade tier.';
    $canon = SITE . '/relics';
} else {
    $title = 'Relic pool not found | Arcadia';
    $desc = 'That ability is not in the relic database.';
    $canon = SITE . '/relics';
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
<meta property="og:title" content="<?= e($pool ? $pool['ability'] . ' relics — Arcadia' : $title) ?>">
<meta property="og:description" content="<?= e($desc) ?>">
<meta property="og:url" content="<?= e($canon) ?>">
<meta property="og:image" content="<?= SITE ?>/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?= e($pool ? $pool['ability'] . ' relics — Arcadia' : $title) ?>">
<meta name="twitter:description" content="<?= e($desc) ?>">
<meta name="twitter:image" content="<?= SITE ?>/og.jpg">
<?php if (!$pool && !$isIndex): ?><meta name="robots" content="noindex,follow"><?php endif; ?>
<style>
/* Same two self-hosted faces as the planner and the item pages. Karla is one
   variable font covering both weights, declared once over a range. */
@font-face{font-family:'Karla';src:url(/fonts/karla.woff2) format('woff2');
  font-weight:400 700;font-style:normal;font-display:swap}
@font-face{font-family:'Silkscreen';src:url(/fonts/silkscreen.woff2) format('woff2');
  font-weight:400;font-style:normal;font-display:swap}
:root{
  --void:#0D0A11; --panel:#1B1520; --panel2:#241C2A;
  --edge:#3A2C42; --amber:#E8913A; --amber-dim:#8A5A2C; --amber-ink:#F0A253;
  --ink:#F0E9E2; --dim:#B3A9B8; --faint:#8B8290;
  --cyan:#6FB8DC; --green:#77C25A; --gold:#E8C24A; --violet:#B98CD8;
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
.sub{font-size:13px;color:var(--amber-ink);opacity:.9;margin-bottom:18px}
h2{font-family:var(--pixel);font-size:15px;color:var(--ink);margin:32px 0 10px}
.meta{font-size:13.5px;color:var(--dim)}
.lead{font-size:14px;color:var(--dim);margin:0 0 22px;max-width:62ch}

/* A relic family is a card: the name, then its upgrade steps in order. The
   step number sits in the value column so it lines up like a tooltip stat. */
.pool{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.rel{background:#150F1A;border:1px solid var(--amber-dim);padding:12px 14px 13px}
.rel.solo{border-color:var(--edge)}
.rel .rn{font-family:var(--pixel);font-size:13px;color:var(--amber);
  display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;margin-bottom:8px}
.step{display:flex;gap:10px;align-items:baseline;font-size:13.5px;line-height:1.5;
  padding:3px 0}
.step+.step{border-top:1px dotted var(--edge)}
.step .t{font-family:var(--pixel);font-size:10.5px;color:var(--faint);
  min-width:26px;flex:0 0 auto;letter-spacing:.5px}
.step .x{color:var(--dim)}
.step:first-of-type .x{color:var(--ink)}
.rtag{font-family:var(--pixel);font-size:9px;padding:2px 5px;letter-spacing:.5px;
  border:1px solid currentColor;white-space:nowrap}
.rtag.dot{color:var(--gold)}
.rtag.conv{color:var(--violet)}
.solo-list .step{padding:6px 0}
.solo-list .step .t{color:var(--edge)}

/* Index: one row per ability, showing what its pool is made of. */
.abl{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
  margin-bottom:8px}
.ab{display:block;text-decoration:none;background:var(--panel);
  border:1px solid var(--edge);padding:12px 14px;transition:border-color .12s}
.ab:hover,.ab:focus-visible{border-color:var(--amber)}
.ab .n{font-family:var(--pixel);font-size:13px;color:var(--amber-ink);
  display:block;margin-bottom:4px}
.ab .c{font-size:12.5px;color:var(--faint)}
.ab .s{font-size:12px;color:var(--cyan);margin-top:5px;display:block}
.note{border-left:2px solid var(--amber-dim);padding:2px 0 2px 12px;margin:16px 0;
  font-size:13px;color:var(--faint);max-width:64ch}
.cta{display:inline-block;margin-top:8px;background:var(--amber);color:#1a1208;
  font-weight:700;text-decoration:none;padding:10px 16px;font-size:14px}
.cta:hover{background:var(--amber-ink)}
.scaled{font-size:12.5px;color:var(--faint);margin-top:2px}
.scaled b{color:var(--cyan);font-weight:400}
footer{margin-top:44px;padding-top:16px;border-top:1px solid var(--edge);
  font-size:12px;color:var(--faint);line-height:1.65}
footer a{color:var(--dim)}
@media (max-width:560px){ h1{font-size:21px} .wrap{padding:16px 13px 48px} }

/* Section nav, matching the planner: the catalogues interlink rather than each
   being a dead end that only leads back to the planner. */
nav.sitenav{display:flex;gap:2px;flex-wrap:wrap;margin:0 0 18px;
  border-bottom:1px solid var(--edge)}
nav.sitenav a{font-family:var(--pixel);font-size:10.5px;letter-spacing:.5px;
  color:var(--faint);text-decoration:none;padding:8px 13px;
  border:1px solid transparent;border-bottom:none;margin-bottom:-1px}
nav.sitenav a:hover{color:var(--amber-ink);background:var(--panel)}
nav.sitenav a[aria-current="page"]{color:var(--amber);background:var(--panel);
  border-color:var(--edge);border-bottom:1px solid var(--panel)}
@media (max-width:560px){ nav.sitenav a{padding:8px 10px;font-size:10px} }
</style>
</head>
<body>
<div class="wrap">
<header class="top">
  <a class="logo" href="/">Arcadia</a>
  <span class="tag">build planner for Soulbound: Online</span>
</header>

<nav class="sitenav" aria-label="Sections">
  <a href="/">Planner</a>
  <a href="/items">Items</a>
  <a href="/relics" aria-current="page">Relics</a>
  <a href="/gaps">Gaps</a>
  <a href="/gallery">Gallery</a>
</nav>

<?php if ($pool): ?>
<nav class="crumb"><a href="/">Planner</a> &rsaquo; <a href="/relics">Relics</a> &rsaquo; <?= e($pool['ability']) ?></nav>
<h1><?= e($pool['ability']) ?> relics</h1>
<div class="sub"><?= (int) $pool['count'] ?> relics
  <?php if ($pool['tierLines']): ?>&middot; <?= (int) $pool['tierLines'] ?> upgrade steps<?php endif; ?>
  <?php if ($pool['type']): ?>&middot; <?= e(ucfirst(strtolower($pool['type']))) ?><?php endif; ?>
</div>

<?php if ($pool['by']): ?>
<div class="scaled">Scales with
  <?php $lbl = array_map(fn($k) => '<b>' . e(attrLabel($k)) . '</b>', $pool['by']);
        echo implode(', ', $lbl); ?>.</div>
<?php endif; ?>

<p class="lead">Relics are picked <b>during a run</b>, one per dungeon level, and they last
only for that run &mdash; they are not gear and they do not change your character sheet.
Which pool you are offered depends on what you have equipped, so this is what a run can
offer while <?= e($pool['ability']) ?> is in your loadout.</p>

<?php if ($pool['families']): ?>
<h2>Upgrade paths</h2>
<p class="meta">Take one of these again and it improves. The steps are in the order they
come.</p>
<div class="pool">
<?php foreach ($pool['families'] as $f): ?>
  <div class="rel">
    <div class="rn"><?= e($f['name']) ?>
      <?php if (!empty($f['dot'])): ?><span class="rtag dot">DoT</span><?php endif; ?>
      <?php if (!empty($f['conv'])): ?><span class="rtag conv">&rarr; <?= e($f['conv']) ?></span><?php endif; ?>
    </div>
    <?php foreach ($f['tiers'] as $n => $t): ?>
      <div class="step"><span class="t"><?= e(roman($n + 1)) ?></span><span class="x"><?= e($t) ?></span></div>
    <?php endforeach; ?>
  </div>
<?php endforeach; ?>
</div>
<?php endif; ?>

<?php if ($pool['standalone']): ?>
<h2>Standalone</h2>
<p class="meta">One-off relics with no upgrade path.</p>
<div class="rel solo solo-list">
  <?php foreach ($pool['standalone'] as $s): ?>
    <div class="step"><span class="t">&bull;</span><span class="x"><?= e($s['text']) ?>
      <?php if (!empty($s['dot'])): ?><span class="rtag dot">DoT</span><?php endif; ?>
      <?php if (!empty($s['conv'])): ?><span class="rtag conv">&rarr; <?= e($s['conv']) ?></span><?php endif; ?>
    </span></div>
  <?php endforeach; ?>
</div>
<?php endif; ?>

<h2>Plan around them</h2>
<p class="meta">The planner reads your loadout and ranks which of these pools your gear
actually supports &mdash; a relic that converts your damage type is worth very little if
none of your gear scales it.</p>
<!-- Carries the ability through, so the planner opens with it already slotted
     rather than making you find it again in a dropdown. -->
<a class="cta" href="/?ability=<?= e($pool['id']) ?>">Open the planner with <?= e($pool['ability']) ?></a>

<script type="application/ld+json"><?= json_encode([
  '@context' => 'https://schema.org',
  '@type' => 'ItemPage',
  'name' => $pool['ability'] . ' relics',
  'url' => $canon,
  'description' => $desc,
  'isPartOf' => ['@type' => 'WebSite', 'name' => 'Arcadia', 'url' => SITE],
  'breadcrumb' => ['@type' => 'BreadcrumbList', 'itemListElement' => [
      ['@type' => 'ListItem', 'position' => 1, 'name' => 'Relics', 'item' => SITE . '/relics'],
      ['@type' => 'ListItem', 'position' => 2, 'name' => $pool['ability'], 'item' => $canon],
  ]],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?></script>

<?php elseif ($isIndex):
  $abil = array_values(array_filter($POOLS, fn($p) => empty($p['isWeapon'])));
  $weap = array_values(array_filter($POOLS, fn($p) => !empty($p['isWeapon']))); ?>
<nav class="crumb"><a href="/">Planner</a> &rsaquo; Relics</nav>
<h1>Relic database</h1>
<div class="sub"><?= $totalRelics ?> relics &middot; <?= count($POOLS) ?> pools &middot;
  every upgrade step</div>

<p class="lead">Relics are picked <b>during a run</b>, one per dungeon level, and last only
for that run &mdash; they are not gear. Which pool you are offered depends on what you have
equipped, so they are listed by the ability that unlocks them. Locked tiers still appear:
a lower-level ability shows the same relics with more of them greyed out in game.</p>

<h2>Abilities</h2>
<div class="abl">
<?php foreach ($abil as $p): ?>
  <a class="ab" href="/relic/<?= e($p['slug']) ?>">
    <span class="n"><?= e($p['ability']) ?></span>
    <span class="c"><?= (int) $p['count'] ?> relics<?php
      if ($p['tierLines']) echo ' &middot; ' . (int) $p['tierLines'] . ' upgrade steps'; ?></span>
    <?php if ($p['by']): ?><span class="s"><?= e(implode(', ', array_map('attrLabel', $p['by']))) ?></span><?php endif; ?>
  </a>
<?php endforeach; ?>
</div>

<h2>Weapon attacks</h2>
<p class="meta">Weapon relics come from the weapon class you are holding, not from a
slotted ability.</p>
<div class="abl">
<?php foreach ($weap as $p): ?>
  <a class="ab" href="/relic/<?= e($p['slug']) ?>">
    <span class="n"><?= e($p['ability']) ?></span>
    <span class="c"><?= (int) $p['count'] ?> relics<?php
      if ($p['tierLines']) echo ' &middot; ' . (int) $p['tierLines'] . ' upgrade steps'; ?></span>
    <?php if ($p['by']): ?><span class="s"><?= e(implode(', ', array_map('attrLabel', $p['by']))) ?></span><?php endif; ?>
  </a>
<?php endforeach; ?>
</div>

<div class="note">Measured from play rather than published anywhere, so treat it as a
community record: a patch can change any of it, and what the game shows you in a run is
always the authority.</div>

<script type="application/ld+json"><?= json_encode([
  '@context' => 'https://schema.org',
  '@type' => 'CollectionPage',
  'name' => 'Relic database',
  'url' => $canon,
  'description' => $desc,
  'isPartOf' => ['@type' => 'WebSite', 'name' => 'Arcadia', 'url' => SITE],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?></script>

<?php else: ?>
<nav class="crumb"><a href="/">Planner</a> &rsaquo; <a href="/relics">Relics</a></nav>
<h1>Not found</h1>
<p class="meta">There is no relic pool at that address. It may have been renamed in a patch.</p>
<a class="cta" href="/relics">Browse every relic</a>
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
