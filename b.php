<?php
/**
 * Link previews for shared builds: /b/<id>
 *
 * The tool is pinned in the game's Discord and builds get shared there
 * constantly, but every one of them unfurled as the same generic site card --
 * the reader could not tell a Gleam Twins crit build from a Fortify tank
 * without opening it. This serves the same index.html with the og: tags
 * rewritten to describe the actual build.
 *
 * It changes nothing for a human visitor: the body is byte-for-byte the app,
 * which then loads the build by id exactly as it did before. Only the head
 * differs, and only for a request that named a real build.
 *
 * The one hard rule this file must honour: the app has never depended on the
 * backend, and must not start now. Every failure path -- no database, bad id,
 * unreadable payload -- falls through to serving index.html untouched.
 */

declare(strict_types=1);

const APP = __DIR__ . '/index.html';
const DATA = __DIR__ . '/items.json';
const SITE = 'https://arcadia.carl-prewitt.com';

ini_set('display_errors', '0');
ini_set('log_errors', '1');

/** Serve the app exactly as it is, and stop. The fallback for every failure. */
function plain(): never {
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: public, max-age=0, must-revalidate');
    readfile(APP);
    exit;
}

set_exception_handler(static function (Throwable $e): void {
    error_log('arcadia b: ' . $e);
    if (!headers_sent()) plain();
});

$id = (string) ($_GET['id'] ?? '');
if (!preg_match('/^[A-Za-z0-9]{4,12}$/', $id)) plain();

$cfgPath = __DIR__ . '/api/config.php';
if (!is_file($cfgPath)) plain();
$cfg = require $cfgPath;

try {
    $pdo = new PDO(
        "mysql:host={$cfg['db_host']};dbname={$cfg['db_name']};charset=utf8mb4",
        $cfg['db_user'], $cfg['db_pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
         PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
         PDO::ATTR_EMULATE_PREPARES => false,
         // A preview is a nicety; the page is not. If the database is not
         // answering promptly, give up and serve the app rather than making
         // every shared link wait out a default connect timeout.
         PDO::ATTR_TIMEOUT => 2]
    );
    // Read only. The hit counter belongs to api/build.php, which the app calls
    // anyway; counting here as well would double every visit.
    $st = $pdo->prepare('SELECT payload, title, author, published, hidden
                         FROM builds WHERE id = ? LIMIT 1');
    $st->execute([$id]);
    $row = $st->fetch();
} catch (Throwable $e) {
    error_log('arcadia b: ' . $e->getMessage());
    plain();
}

if (!$row || (int) ($row['hidden'] ?? 0) === 1) plain();

/**
 * Undo encodeBuild(): base64url, optionally raw-deflated behind a "c." marker.
 * Returns null on anything unexpected -- a preview is never worth an error.
 */
function decodePayload(string $p): ?array {
    $compressed = str_starts_with($p, 'c.');
    if ($compressed) $p = substr($p, 2);
    $b64 = strtr($p, '-_', '+/');
    $b64 .= str_repeat('=', (4 - strlen($b64) % 4) % 4);
    $bin = base64_decode($b64, true);
    if ($bin === false || $bin === '') return null;
    if ($compressed) {
        $bin = @gzinflate($bin);          // deflate-raw, same as CompressionStream
        if ($bin === false) return null;
    }
    $json = json_decode($bin, true);
    return is_array($json) ? $json : null;
}

$build = decodePayload((string) $row['payload']);
$meta = @json_decode((string) @file_get_contents(DATA), true) ?: [];
$ABIL = $meta['abilities'] ?? [];
$SLOTS = $meta['slots'] ?? [];

// What the build actually runs, in the order the player put them in.
$abilities = [];
foreach ((array) ($build['l'] ?? []) as $i) {
    if (is_int($i) && $i >= 0 && isset($ABIL[$i]['name'])) $abilities[] = $ABIL[$i]['name'];
}

// Named gear, for the line under the abilities.
$gear = [];
foreach ((array) ($build['g'] ?? []) as $n => $slot) {
    if (!is_array($slot)) continue;
    $name = trim((string) ($slot[0] ?? ''));
    if ($name !== '') $gear[] = $name;
}

$published = (int) ($row['published'] ?? 0) === 1;
$title = trim((string) ($row['title'] ?? ''));
$author = trim((string) ($row['author'] ?? ''));

// A published build has a title its author chose; an unpublished one is
// described by what it runs, which is the only honest thing to call it.
if ($published && $title !== '') {
    $ogTitle = $title . ($author !== '' ? ' — by ' . $author : '') . ' | Arcadia';
} elseif ($abilities) {
    $ogTitle = implode(' · ', array_slice($abilities, 0, 4)) . ' — a Soulbound build on Arcadia';
} else {
    plain();   // nothing worth saying; the generic card is not worse
}

$bits = [];
if ($abilities) $bits[] = 'Runs ' . implode(', ', $abilities) . '.';
if ($gear) {
    $shown = array_slice($gear, 0, 4);
    $bits[] = 'Gear includes ' . implode(', ', $shown)
            . (count($gear) > count($shown) ? ' and ' . (count($gear) - count($shown)) . ' more' : '') . '.';
}
$bits[] = 'Open it in Arcadia to see which attributes actually scale it, and compare your own gear against it.';
$ogDesc = implode(' ', $bits);

$url = SITE . '/b/' . $id;
$html = @file_get_contents(APP);
if ($html === false) plain();

/** Attribute-safe. The title and author are player-written text. */
function a(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/* Matched by shape, never by the current wording. These tags get copy-edited,
 * and an exact-string swap would go quietly dead the first time someone
 * reworded the tagline -- previews would silently revert to the generic card
 * with nothing failing loudly enough to notice. A build page is also marked
 * noindex: it is one view of one build, not a second copy of the planner. */
$patterns = [
    '/<title>.*?<\/title>/s'                              => '<title>' . a($ogTitle) . '</title>',
    '/<meta property="og:title" content="[^"]*"\s*\/?>/'  => '<meta property="og:title" content="' . a($ogTitle) . '"/>',
    '/<meta name="twitter:title" content="[^"]*"\s*\/?>/' => '<meta name="twitter:title" content="' . a($ogTitle) . '"/>',
    '/<meta property="og:description" content="[^"]*"\s*\/?>/'  => '<meta property="og:description" content="' . a($ogDesc) . '"/>',
    '/<meta name="twitter:description" content="[^"]*"\s*\/?>/' => '<meta name="twitter:description" content="' . a($ogDesc) . '"/>',
    '/<meta name="description" content="[^"]*"\s*\/?>/'   => '<meta name="description" content="' . a($ogDesc) . '"/>',
    '/<meta property="og:url" content="[^"]*"\s*\/?>/'    => '<meta property="og:url" content="' . a($url) . '"/>',
    '/<link rel="canonical" href="[^"]*"\s*\/?>/'         => '<link rel="canonical" href="' . a($url) . '"/>',
    '/<meta name="robots" content="[^"]*"\s*\/?>/'        => '<meta name="robots" content="noindex,follow,max-image-preview:large"/>',
];

$out = $html;
$applied = 0;
foreach ($patterns as $re => $rep) {
    // A literal $ in a player's build title is a backreference to preg_replace.
    $done = preg_replace($re, str_replace(['\\', '$'], ['\\\\', '\\$'], $rep), $out, 1, $n);
    if ($done !== null) { $out = $done; $applied += $n; }
}

// If the head stopped looking the way this expects, serving the generic card is
// correct, but it should not happen silently -- that is how a broken preview
// survives for weeks.
if ($applied < 4) {
    error_log('arcadia b: only ' . $applied . ' of ' . count($patterns)
              . ' head tags matched; index.html head may have changed shape');
    plain();
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300');
echo $out;
