<?php
/**
 * Arcadia gallery API.
 *
 *   GET  ?sort=top|new [&ability=<id>] [&page=0]   -> {builds:[…], more:bool}
 *   POST {action:"publish", id, title, author, summary}
 *   POST {action:"vote",    id}
 *   POST {action:"hide",    id, admin}             -> moderation
 *
 * Builds are private until published. No accounts; votes are one-per-address
 * using a salted hash, so a raw IP is never stored.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

// Never let a stack trace reach the browser: a trace prepended to the body makes
// the JSON unparseable, which the client reports as a blank gallery rather than
// as an error. Log it instead and answer with a plain 500.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
set_exception_handler(static function (Throwable $e): void {
    error_log('arcadia gallery: ' . $e);
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
});

function fail(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

$cfgPath = __DIR__ . '/config.php';
if (!is_file($cfgPath)) fail(500, 'Server not configured');
$cfg = require $cfgPath;

try {
    $pdo = new PDO(
        "mysql:host={$cfg['db_host']};dbname={$cfg['db_name']};charset=utf8mb4",
        $cfg['db_user'], $cfg['db_pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
         PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
         PDO::ATTR_EMULATE_PREPARES => false]
    );
} catch (Throwable $e) {
    fail(500, 'Database unavailable');
}

// REMOTE_ADDR only: there is no proxy in front of this host, so any forwarding
// header is client-controlled and honouring one would let a single sender mint
// unlimited rate-limit and vote identities. IPv6 counts by /64, since one
// residential prefix hands out that whole space.
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
if (str_contains($ip, ':')) {
    $bin = @inet_pton($ip);
    if ($bin !== false) $ip = inet_ntop(substr($bin, 0, 8) . str_repeat("\0", 8)) . '/64';
}
$ipHash = hash('sha256', $cfg['ip_salt'] . $ip);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$PAGE   = 24;

// Writes must come from the site itself. Sec-Fetch-Site is set by every browser
// Arcadia supports and cannot be set by page script; the Origin check is the
// fallback for anything that omits it. Without this, a page anywhere on the web
// can fire no-cors POSTs that vote or publish on behalf of whoever views it.
if ($method === 'POST') {
    $sfs    = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host   = $_SERVER['HTTP_HOST'] ?? '';
    $sameOrigin = $sfs === 'same-origin'
        || ($sfs === '' && $origin !== '' && parse_url($origin, PHP_URL_HOST) === $host)
        || ($sfs === '' && $origin === '');   // curl and same-origin non-fetch fallback
    if (!$sameOrigin) fail(403, 'Cross-site request refused');
}

/* ------------------------------ list ------------------------------ */
if ($method === 'GET') {
    $sortRaw = (string) ($_GET['sort'] ?? 'top');
    $sort    = in_array($sortRaw, ['new', 'opened'], true) ? $sortRaw : 'top';
    $page    = max(0, min(100, (int) ($_GET['page'] ?? 0)));
    $ability = (string) ($_GET['ability'] ?? '');
    $query   = trim((string) ($_GET['q'] ?? ''));

    $where  = 'published = 1 AND hidden = 0';
    $params = [];
    if ($ability !== '') {
        if (!preg_match('/^[a-z_]{2,32}$/', $ability)) fail(400, 'Bad filter');
        // summary is small JSON; a LIKE against it is fine at this scale
        $where .= ' AND summary LIKE ?';
        $params[] = '%"' . $ability . '"%';
    }
    if ($query !== '') {
        // Search what the author actually wrote: the title, their name, and the
        // notes explaining the build. LIKE is bound, and the wildcards in the
        // term itself are escaped so a stray % cannot widen the match.
        if (mb_strlen($query) > 60) fail(400, 'Search term too long');
        $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $query) . '%';
        $where .= ' AND (title LIKE ? OR author LIKE ? OR notes LIKE ?)';
        array_push($params, $like, $like, $like);
    }
    $order = $sort === 'new'    ? 'published_at DESC'
           : ($sort === 'opened' ? 'hits DESC, votes DESC, published_at DESC'
                                 : 'votes DESC, published_at DESC');

    $sql  = "SELECT id, title, author, notes, summary, votes, hits, published_at
             FROM builds WHERE $where ORDER BY $order LIMIT " . ($PAGE + 1) . " OFFSET " . ($page * $PAGE);
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $more = count($rows) > $PAGE;
    if ($more) array_pop($rows);

    // Which of these has this visitor already voted on?
    $voted = [];
    if ($rows) {
        $ids = array_column($rows, 'id');
        $in  = implode(',', array_fill(0, count($ids), '?'));
        $vs  = $pdo->prepare("SELECT build_id FROM votes WHERE ip_hash = ? AND build_id IN ($in)");
        $vs->execute(array_merge([$ipHash], $ids));
        $voted = array_column($vs->fetchAll(), 'build_id');
    }

    foreach ($rows as &$r) {
        $r['votes']   = (int) $r['votes'];
        $r['hits']    = (int) $r['hits'];
        $r['summary'] = json_decode((string) $r['summary'], true) ?: null;
        $r['voted']   = in_array($r['id'], $voted, true);
    }
    unset($r);

    // private: each response embeds this visitor's own voted flags, so a shared
    // cache would hand one visitor's state to the next.
    header('Cache-Control: private, max-age=30');
    echo json_encode(['builds' => $rows, 'more' => $more]);
    exit;
}

if ($method !== 'POST') fail(405, 'Method not allowed');

// A legitimate publish is title + name + notes + a six-entry summary: under 2 KB.
// Without a cap the ceiling is post_max_size, megabytes decoded before validation.
$raw = file_get_contents('php://input') ?: '';
if (strlen($raw) > 4000) fail(413, 'Request too large');
$body   = json_decode($raw, true);
$action = is_array($body) ? (string) ($body['action'] ?? '') : '';
$id     = is_array($body) ? (string) ($body['id'] ?? '') : '';
if (!preg_match('/^[A-Za-z0-9]{4,12}$/', $id)) fail(400, 'Bad id');

/* ---------------------------- moderation ---------------------------- */
if ($action === 'hide') {
    $token = (string) ($body['admin'] ?? '');
    $want  = (string) ($cfg['admin_token'] ?? '');
    if ($want === '' || !hash_equals($want, $token)) fail(403, 'Nope');
    $pdo->prepare('UPDATE builds SET hidden = 1 WHERE id = ?')->execute([$id]);
    echo json_encode(['ok' => true]);
    exit;
}

/* ------------------------------- vote ------------------------------- */
if ($action === 'vote') {
    $chk = $pdo->prepare('SELECT 1 FROM builds WHERE id = ? AND published = 1 AND hidden = 0');
    $chk->execute([$id]);
    if (!$chk->fetch()) fail(404, 'Not found');

    try {
        $pdo->prepare('INSERT INTO votes (build_id, ip_hash, created_at) VALUES (?, ?, NOW())')
            ->execute([$id, $ipHash]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {          // already voted -> toggle off
            $pdo->prepare('DELETE FROM votes WHERE build_id = ? AND ip_hash = ?')->execute([$id, $ipHash]);
            $pdo->prepare('UPDATE builds SET votes = GREATEST(votes - 1, 0) WHERE id = ?')->execute([$id]);
            $n = $pdo->prepare('SELECT votes FROM builds WHERE id = ?');
            $n->execute([$id]);
            echo json_encode(['votes' => (int) $n->fetch()['votes'], 'voted' => false]);
            exit;
        }
        fail(500, 'Could not vote');
    }
    $pdo->prepare('UPDATE builds SET votes = votes + 1 WHERE id = ?')->execute([$id]);
    $n = $pdo->prepare('SELECT votes FROM builds WHERE id = ?');
    $n->execute([$id]);
    echo json_encode(['votes' => (int) $n->fetch()['votes'], 'voted' => true]);
    exit;
}

/* ------------------------------ publish ------------------------------ */
if ($action !== 'publish') fail(400, 'Unknown action');

$title  = trim((string) ($body['title'] ?? ''));
$author = trim((string) ($body['author'] ?? ''));
$notes  = trim((string) ($body['notes'] ?? ''));
$sum    = $body['summary'] ?? null;

// Strip control characters and collapse whitespace; output is escaped client-side too.
// Each step guards its own result: with the /u modifier preg_replace returns null
// on malformed UTF-8, and passing that straight into the next call is a TypeError
// under strict_types. $cleanMultiline below already does this correctly.
$clean = static function (string $s): string {
    $s = preg_replace('/[\x00-\x1F\x7F]/u', '', $s) ?? '';
    $s = preg_replace('/\s+/u', ' ', $s) ?? '';
    return trim($s);
};

// Notes are the one field where line breaks carry meaning, so newlines survive
// while every other control character does not. Runs of blank lines collapse to
// one so a wall of padding cannot stretch a gallery card.
$cleanMultiline = static function (string $s): string {
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    $s = str_replace("\r\n", "\n", $s);
    $s = preg_replace('/[ \t]+/u', ' ', $s) ?? '';
    $s = preg_replace('/\n{3,}/u', "\n\n", $s) ?? '';
    return trim($s);
};

$title  = $clean($title);
$author = $clean($author);
$notes  = $cleanMultiline($notes);

if (mb_strlen($title) < 3 || mb_strlen($title) > 80)  fail(400, 'Title must be 3–80 characters');
if (mb_strlen($author) > 40)                          fail(400, 'Name too long');
if (mb_strlen($notes) > 800)                          fail(400, 'Notes must be 800 characters or fewer');
if (!is_array($sum))                                  fail(400, 'Missing summary');

$summary = json_encode([
    'abilities' => array_values(array_slice(
        array_filter((array) ($sum['abilities'] ?? []), static fn($a) => is_string($a) && preg_match('/^[a-z_]{2,32}$/', $a)),
        0, 6)),
    // array_values twice, deliberately: array_slice keeps string keys, and a
    // summary stored as a JSON object instead of an array makes the gallery
    // renderer throw on .map, which blanks the listing for every visitor.
    'attrs' => array_values(array_map(
        static fn($v): int => max(0, min(9999, (int) $v)),
        array_slice(array_values((array) ($sum['attrs'] ?? [])), 0, 6))),
], JSON_UNESCAPED_SLASHES);

// Publishing is rate limited harder than plain sharing.
try {
    $pdo->exec('DELETE FROM rate_limit WHERE window_start < (NOW() - INTERVAL 1 HOUR)');
    $c = $pdo->prepare('SELECT COUNT(*) AS n FROM rate_limit WHERE ip_hash = ?');
    $c->execute([$ipHash]);
    if ((int) ($c->fetch()['n'] ?? 0) >= 10) fail(429, 'You have published a lot recently — try again later');
} catch (PDOException $e) {
}

// Publishing is one-way: a build enters the gallery once and its text is fixed
// from then on. Ids are public (they are in every gallery listing and /b/ link),
// so without this an already-listed build could be re-titled by anyone who can
// read it, keeping the votes it earned under its original description.
$state = $pdo->prepare('SELECT published, hidden FROM builds WHERE id = ?');
$state->execute([$id]);
$row = $state->fetch();
if (!$row)                        fail(404, 'Build not found — share it first');
if ((int) $row['hidden'] === 1)   fail(403, 'That build has been withdrawn');
if ((int) $row['published'] === 1) fail(409, 'That build is already in the gallery');

$pdo->prepare(
    'UPDATE builds SET title = ?, author = ?, notes = ?, summary = ?, published = 1,
            published_at = COALESCE(published_at, NOW())
     WHERE id = ? AND published = 0 AND hidden = 0'
)->execute([$title, $author !== '' ? $author : null, $notes !== '' ? $notes : null, $summary, $id]);

try {
    $pdo->prepare('INSERT INTO rate_limit (ip_hash, window_start) VALUES (?, NOW())')->execute([$ipHash]);
} catch (Throwable $e) {
}

echo json_encode(['ok' => true, 'id' => $id]);
