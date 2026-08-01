<?php
/**
 * Arcadia short-link API.
 *
 *   POST /api/build.php    body: {"p":"c.<payload>"}   -> {"id":"x7k2p"}
 *   GET  /api/build.php?id=x7k2p                       -> {"p":"c.<payload>"}
 *
 * Stores only the encoded build string. No accounts, no personal data; IP
 * addresses are salted-hashed for rate limiting and never stored raw.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
// No CORS header: the page and this endpoint are the same origin, so none is
// needed. The old one sent a bare hostname, which is not a valid origin and so
// never matched anything -- it only read as though sharing were intended.

// Keep error detail out of the response body; a trace prepended to the JSON is
// what turns a server fault into an unexplained client-side parse failure.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
set_exception_handler(static function (Throwable $e): void {
    error_log('arcadia build: ' . $e);
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
});

function fail(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    fail(500, 'Server not configured');
}
$cfg = require $configPath;

try {
    $pdo = new PDO(
        "mysql:host={$cfg['db_host']};dbname={$cfg['db_name']};charset=utf8mb4",
        $cfg['db_user'],
        $cfg['db_pass'],
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (Throwable $e) {
    fail(500, 'Database unavailable');
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Writes must originate from the site itself. Sec-Fetch-Site comes from the
// browser and page script cannot set it; Origin is the fallback for clients
// that omit it.
if ($method === 'POST') {
    $sfs    = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host   = $_SERVER['HTTP_HOST'] ?? '';
    $sameOrigin = $sfs === 'same-origin'
        || ($sfs === '' && $origin !== '' && parse_url($origin, PHP_URL_HOST) === $host)
        || ($sfs === '' && $origin === '');
    if (!$sameOrigin) fail(403, 'Cross-site request refused');
}

/* ----------------------------- read ----------------------------- */
if ($method === 'GET') {
    $id = (string) ($_GET['id'] ?? '');
    if (!preg_match('/^[A-Za-z0-9]{4,12}$/', $id)) {
        fail(400, 'Bad id');
    }

    // hidden = 0 so moderation actually withdraws a build. Without it, hiding
    // removed the gallery card while /b/<id> kept serving the same build.
    $stmt = $pdo->prepare('SELECT payload FROM builds WHERE id = ? AND hidden = 0 LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        fail(404, 'Not found');
    }

    // Best-effort popularity counter; a failure here must not break the read.
    try {
        $pdo->prepare('UPDATE builds SET hits = hits + 1 WHERE id = ?')->execute([$id]);
    } catch (Throwable $e) {
    }

    header('Cache-Control: public, max-age=300');
    echo json_encode(['p' => $row['payload']]);
    exit;
}

/* ----------------------------- create ----------------------------- */
if ($method !== 'POST') {
    fail(405, 'Method not allowed');
}

$raw = file_get_contents('php://input') ?: '';
if (strlen($raw) > $cfg['max_payload_bytes'] + 200) {
    fail(413, 'Too large');
}

$body    = json_decode($raw, true);
$payload = is_array($body) ? (string) ($body['p'] ?? '') : '';

// Must look like something encodeBuild() produced: optional "c." marker
// followed by base64url. Anything else is not ours.
if (!preg_match('/^(c\.)?[A-Za-z0-9_-]+$/', $payload)) {
    fail(400, 'Bad payload');
}
if (strlen($payload) < 8 || strlen($payload) > $cfg['max_payload_bytes']) {
    fail(400, 'Bad payload size');
}

// REMOTE_ADDR only: nothing proxies this host, so a forwarding header here would
// be caller-supplied and would let one sender count as many. IPv6 is grouped by
// /64, since a single home connection is handed that whole range.
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
if (str_contains($ip, ':')) {
    $bin = @inet_pton($ip);
    if ($bin !== false) $ip = inet_ntop(substr($bin, 0, 8) . str_repeat("\0", 8)) . '/64';
}
$ipHash = hash('sha256', $cfg['ip_salt'] . $ip);

// Rate limit, and opportunistically drop expired rows.
try {
    $pdo->exec('DELETE FROM rate_limit WHERE window_start < (NOW() - INTERVAL 1 HOUR)');
    $stmt = $pdo->prepare('SELECT COUNT(*) AS n FROM rate_limit WHERE ip_hash = ?');
    $stmt->execute([$ipHash]);
    if ((int) ($stmt->fetch()['n'] ?? 0) >= (int) $cfg['rate_limit_per_hour']) {
        fail(429, 'Slow down a moment');
    }
} catch (PDOException $e) {
    // Rate-limit table problems shouldn't take the feature down.
}

// Identical builds reuse their existing id, so re-sharing doesn't fill the table.
$hash = hash('sha256', $payload);
$stmt = $pdo->prepare('SELECT id FROM builds WHERE payload_hash = ? LIMIT 1');
$stmt->execute([$hash]);
if ($existing = $stmt->fetch()) {
    echo json_encode(['id' => $existing['id'], 'reused' => true]);
    exit;
}

/** Unambiguous alphabet: no 0/O/1/l/I. */
function makeId(int $len): string {
    $alphabet = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
    $out      = '';
    $max      = strlen($alphabet) - 1;
    for ($i = 0; $i < $len; $i++) {
        $out .= $alphabet[random_int(0, $max)];
    }
    return $out;
}

$insert = $pdo->prepare(
    'INSERT INTO builds (id, payload, payload_hash, created_at) VALUES (?, ?, ?, NOW())'
);

// Widen the id if we somehow keep colliding.
for ($attempt = 0; $attempt < 12; $attempt++) {
    $id = makeId(5 + intdiv($attempt, 4));
    try {
        $insert->execute([$id, $payload, $hash]);
        try {
            $pdo->prepare('INSERT INTO rate_limit (ip_hash, window_start) VALUES (?, NOW())')
                ->execute([$ipHash]);
        } catch (Throwable $e) {
        }
        echo json_encode(['id' => $id]);
        exit;
    } catch (PDOException $e) {
        if ($e->getCode() !== '23000') {   // not a duplicate-key clash
            fail(500, 'Could not save');
        }
    }
}

fail(500, 'Could not allocate an id');
