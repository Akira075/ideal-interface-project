<?php
// TESTPAD STUDIO — сервер: база данных, авторизация, права ролей. SQLite по умолчанию, MySQL по желанию.
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
ini_set('display_errors', '0');
if (!is_file(__DIR__ . '/config.php')) { http_response_code(500); echo json_encode(['error' => 'На сервере нет файла config.php. Загрузите config.php из архива в ту же папку, где лежит api.php (' . __DIR__ . ').'], JSON_UNESCAPED_UNICODE); exit; }
$CFG = require __DIR__ . '/config.php';
if (!function_exists('mb_substr')) { function mb_substr($s, $a, $l = null) { $c = preg_split('//u', (string)$s, -1, PREG_SPLIT_NO_EMPTY) ?: []; return implode('', $l === null ? array_slice($c, $a) : array_slice($c, $a, $l)); } }
if (!function_exists('mb_strtolower')) { function mb_strtolower($s) { return strtolower((string)$s); } }
if (!function_exists('mb_strlen')) { function mb_strlen($s) { return count(preg_split('//u', (string)$s, -1, PREG_SPLIT_NO_EMPTY) ?: []); } }
const ALLP = ['tests.take','tests.manage','questions.manage','results.viewAll','groups.manage','news.manage','faq.manage','tickets.manage','users.manage','roles.manage','sections.manage','site.manage','logs.view','backup.manage','console.use'];
const MANAGE = ['roles'=>'roles.manage','sections'=>'sections.manage','questions'=>'questions.manage','tests'=>'tests.manage','groups'=>'groups.manage','news'=>'news.manage','faq'=>'faq.manage','settings'=>'site.manage','music'=>'site.manage'];

function out($c, $v) {
    http_response_code($c); $j = json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    if (!empty($GLOBALS['PUSHQ']) && !headers_sent()) { header('Connection: close'); header('Content-Length: ' . strlen($j)); echo $j; while (ob_get_level() > 0) @ob_end_flush(); flush(); } else echo $j;
    exit;
}
function fail($c, $m) { out($c, ['error' => $m]); }
class DbError extends Exception {}
function dbfail($m) { throw new DbError($m); }
set_exception_handler(function ($e) {
    global $CFG;
    try { if (function_exists('db') && !empty($GLOBALS['DBOK']) && db()->inTransaction()) db()->rollBack(); } catch (Throwable $x) {}
    error_log('TESTPAD: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    out(500, ['error' => ($e instanceof DbError || !empty($CFG['debug'])) ? $e->getMessage() : 'Ошибка сервера (подробности: включите debug в config.php или откройте check.php)']);
});
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true) && !headers_sent()) {
        error_log('TESTPAD FATAL: ' . $e['message']); http_response_code(500); header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Ошибка PHP на сервере: ' . $e['message']], JSON_UNESCAPED_UNICODE);
    }
});
function uid($p = '') { return $p . bin2hex(random_bytes(5)); }
function iso() { return gmdate('Y-m-d\TH:i:s') . '.000Z'; }
function ms() { return (int)round(microtime(true) * 1000); }
function str($v, $n = 300) { return is_scalar($v) ? mb_substr(trim((string)$v), 0, $n) : ''; }

function db_sqlite() {
    if (!extension_loaded('pdo_sqlite')) dbfail('На хостинге не включено расширение pdo_sqlite. Включите его в панели хостинга или настройте MySQL в config.php.');
    $dir = __DIR__ . '/data'; if (!is_dir($dir)) @mkdir($dir, 0755, true);
    if (!is_dir($dir) || !is_writable($dir)) dbfail('Нет прав на запись в папку data рядом с api.php. Создайте папку data и дайте ей права 755/775 (или 777).');
    @file_put_contents($dir . '/.htaccess', "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
    $p = new PDO('sqlite:' . $dir . '/app.sqlite'); $p->setAttribute(PDO::ATTR_TIMEOUT, 10); $p->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    @$p->exec('PRAGMA busy_timeout = 8000'); return $p;
}
function db_mysql() {
    global $CFG;
    if (!extension_loaded('pdo_mysql')) dbfail('На хостинге нет ни pdo_sqlite, ни pdo_mysql. Включите одно из расширений в настройках PHP.');
    if (empty($CFG['name'])) dbfail('MySQL не настроен: впишите host, name, user, pass в config.php (или включите pdo_sqlite).');
    $last = null;
    foreach (array_values(array_unique([($CFG['host'] ?? '') ?: 'localhost', 'localhost', '127.0.0.1'])) as $h) {
        try { return new PDO("mysql:host=$h;dbname={$CFG['name']};charset=utf8mb4", $CFG['user'], $CFG['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
        catch (PDOException $e) { $last = $e; }
    }
    $m = $last->getMessage();
    $hint = strpos($m, '1045') !== false ? 'неверный пользователь или пароль' : (strpos($m, '1049') !== false ? 'база с таким именем не найдена (поле name в config.php)' : (strpos($m, '2002') !== false ? 'сервер MySQL недоступен (поле host в config.php)' : $m));
    dbfail('Не удаётся подключиться к MySQL: ' . $hint);
}
function db() {
    static $p; if ($p) return $p; global $CFG; $d = $CFG['driver'] ?? 'auto';
    if ($d === 'sqlite') { $p = db_sqlite(); $GLOBALS['SQLITE'] = true; }
    elseif ($d === 'mysql') { $p = db_mysql(); $GLOBALS['SQLITE'] = false; }
    else {
        try { $p = db_sqlite(); $GLOBALS['SQLITE'] = true; }
        catch (Throwable $e) {
            if (empty($CFG['name'])) throw ($e instanceof DbError ? $e : new DbError('SQLite недоступна: ' . $e->getMessage()));
            try { $p = db_mysql(); $GLOBALS['SQLITE'] = false; } catch (DbError $e2) { dbfail($e->getMessage() . ' | ' . $e2->getMessage()); }
        }
    }
    $p->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION); $p->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC); $GLOBALS['DBOK'] = true;
    return $p;
}
function q($s, $a = []) { $st = db()->prepare($s); $st->execute($a); return $st; }
function cget($c, $id) { $r = q('SELECT data FROM coll WHERE c=? AND id=?', [$c, $id])->fetch(); return $r ? json_decode($r['data'], true) : null; }
function cl($c) { return array_map(fn($r) => json_decode($r['data'], true), q('SELECT data FROM coll WHERE c=? ORDER BY pos ASC, id ASC', [$c])->fetchAll()); }
function cput($c, $id, $d, $pos = null) {
    if ($pos === null) { $r = q('SELECT pos FROM coll WHERE c=? AND id=?', [$c, $id])->fetch(); $pos = $r ? (int)$r['pos'] : (int)q('SELECT COALESCE(MAX(pos),0)+1 m FROM coll WHERE c=?', [$c])->fetch()['m']; }
    $j = json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); if (strlen($j) > 4000000) fail(413, 'Слишком большой объём данных');
    q('REPLACE INTO coll (c,id,pos,data) VALUES (?,?,?,?)', [$c, $id, $pos, $j]);
}

function install() {
    db(); $int = $GLOBALS['SQLITE'] ? 'INTEGER' : 'BIGINT'; $suf = $GLOBALS['SQLITE'] ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    foreach ([
        "CREATE TABLE IF NOT EXISTS users (id VARCHAR(40) NOT NULL PRIMARY KEY, username VARCHAR(64) NOT NULL UNIQUE, nickname VARCHAR(64) NOT NULL UNIQUE, pass VARCHAR(255) NOT NULL, data MEDIUMTEXT NOT NULL)$suf",
        "CREATE TABLE IF NOT EXISTS sessions (th CHAR(64) NOT NULL PRIMARY KEY, uid VARCHAR(40) NOT NULL, ts $int NOT NULL)$suf",
        "CREATE TABLE IF NOT EXISTS coll (c VARCHAR(32) NOT NULL, id VARCHAR(48) NOT NULL, pos $int NOT NULL DEFAULT 0, data MEDIUMTEXT NOT NULL, PRIMARY KEY (c,id))$suf",
        "CREATE TABLE IF NOT EXISTS rate (ip VARCHAR(64) NOT NULL PRIMARY KEY, n INT NOT NULL, until_ms $int NOT NULL)$suf",
    ] as $s) db()->exec($s);
    if (!q("SELECT 1 FROM coll WHERE c='roles' LIMIT 1")->fetch() && is_file(__DIR__ . '/seed.json')) {
        $seed = json_decode(file_get_contents(__DIR__ . '/seed.json'), true) ?: [];
        foreach ($seed as $c => $items) { if ($c === 'settings') { cput('settings', 'main', $items, 0); continue; } foreach ($items as $i => $it) cput($c, $it['id'], $it, $i); }
    }
    if (!q('SELECT 1 FROM users LIMIT 1')->fetch()) {
        global $CFG; $id = uid('u_');
        q('INSERT INTO users (id,username,nickname,pass,data) VALUES (?,?,?,?,?)', [$id, $CFG['dev_username'], $CFG['dev_nickname'], password_hash($CFG['dev_password'], PASSWORD_DEFAULT), json_encode(['fullName' => 'Супер-Разработчик', 'role' => 'dev', 'status' => 'active', 'groups' => ['core'], 'createdAt' => iso()], JSON_UNESCAPED_UNICODE)]);
    }
}
function settings() { return (cget('settings', 'main') ?: []) + ['siteName' => 'TESTPAD STUDIO', 'maintenance' => false, 'requireApproval' => false, 'registrationOpen' => true, 'callsEnabled' => true, 'announcement' => '', 'announcementType' => 'info', 'maintenanceText' => '', 'themeVars' => new stdClass(), 'customCss' => '']; }

function pub($r) { $d = json_decode($r['data'], true) ?: []; return ['id' => $r['id'], 'username' => $r['username'], 'nickname' => $r['nickname'], 'fullName' => $d['fullName'] ?? '', 'role' => $d['role'] ?? 'student', 'status' => $d['status'] ?? 'active', 'groups' => $d['groups'] ?? [], 'createdAt' => $d['createdAt'] ?? '']; }
function udata($u) { return json_encode(['fullName' => $u['fullName'], 'role' => $u['role'], 'status' => $u['status'], 'groups' => $u['groups'], 'createdAt' => $u['createdAt']], JSON_UNESCAPED_UNICODE); }
function body() { static $b; if ($b === null) $b = json_decode(file_get_contents('php://input') ?: '', true) ?: []; return $b; }
function tok() { return $_SERVER['HTTP_X_TOKEN'] ?? ''; }
function me() {
    static $m = false; if ($m !== false) return $m; $m = null; $t = tok(); if (!$t) return null;
    $r = q('SELECT u.* FROM sessions s JOIN users u ON u.id=s.uid WHERE s.th=? AND s.ts>?', [hash('sha256', $t), ms() - 2592000000])->fetch();
    if ($r) { $u = pub($r); if ($u['status'] === 'active') $m = $u; }
    return $m;
}
function perms($u) { if (!$u) return []; if (($u['role'] ?? '') === 'dev') return ALLP; $r = cget('roles', $u['role']); return $r ? ($r['permissions'] ?? []) : []; }
function can($p) { return in_array($p, perms(me()), true); }
function addlog($name, $role, $action, $cat) {
    $id = uid('l'); cput('logs', $id, ['id' => $id, 'time' => iso(), 'user' => $name, 'role' => $role, 'action' => str($action), 'category' => $cat], -ms());
    q("DELETE FROM coll WHERE c='logs' AND pos > (SELECT m FROM (SELECT MAX(pos) m FROM (SELECT pos FROM coll WHERE c='logs' ORDER BY pos ASC LIMIT 1000) a) b)");
}
function needMe() { $u = me(); if (!$u) fail(401, 'Сессия истекла'); return $u; }

// ---------- АВТОРИЗАЦИЯ ----------
function auth() {
    $b = body(); $act = $b['action'] ?? ''; $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if ($act === 'logout') { if (tok()) q('DELETE FROM sessions WHERE th=?', [hash('sha256', tok())]); out(200, ['ok' => true]); }
    if ($act === 'register') {
        $s = settings(); if (isset($s['registrationOpen']) && !$s['registrationOpen']) fail(403, 'Регистрация закрыта администратором'); $un = str($b['username'] ?? '', 32); $nick = str($b['nickname'] ?? '', 32); $full = str($b['fullName'] ?? '', 100); $pw = (string)($b['password'] ?? '');
        if (!preg_match('/^[A-Za-z0-9_]{3,32}$/', $un)) fail(400, 'Логин: 3–32 символа, латиница, цифры и _');
        if (mb_strlen($nick) < 3) fail(400, 'Никнейм — от 3 символов'); if (mb_strlen($pw) < 6) fail(400, 'Пароль — от 6 символов');
        if (q('SELECT 1 FROM users WHERE LOWER(username)=LOWER(?) OR LOWER(nickname)=LOWER(?)', [$un, $nick])->fetch()) fail(409, 'Логин или никнейм уже занят');
        $st = !empty($s['requireApproval']) ? 'pending' : 'active'; $id = uid('u_');
        q('INSERT INTO users (id,username,nickname,pass,data) VALUES (?,?,?,?,?)', [$id, $un, $nick, password_hash($pw, PASSWORD_DEFAULT), udata(['fullName' => $full, 'role' => 'student', 'status' => $st, 'groups' => [], 'createdAt' => iso()])]);
        addlog($nick, 'student', $st === 'pending' ? 'Подал заявку на регистрацию' : 'Зарегистрировался', 'auth');
        if ($st === 'pending') fail(403, 'Заявка отправлена. Дождитесь одобрения администратором.');
        $act = 'login'; $b['username'] = $un; $b['password'] = $pw;
    }
    if ($act === 'login') {
        $r = q('SELECT * FROM rate WHERE ip=?', [$ip])->fetch(); if ($r && $r['until_ms'] > ms()) fail(429, 'Слишком много попыток. Подождите 15 минут.');
        $row = q('SELECT * FROM users WHERE LOWER(username)=LOWER(?) OR LOWER(nickname)=LOWER(?)', [str($b['username'] ?? '', 64), str($b['username'] ?? '', 64)])->fetch();
        if (!$row || !password_verify((string)($b['password'] ?? ''), $row['pass'])) {
            $n = ($r ? (int)$r['n'] : 0) + 1; q('REPLACE INTO rate (ip,n,until_ms) VALUES (?,?,?)', [$ip, $n >= 8 ? 0 : $n, $n >= 8 ? ms() + 900000 : 0]);
            addlog('Гость', 'guest', 'Неудачная попытка входа (' . str($b['username'] ?? '', 40) . ')', 'auth'); fail(401, 'Неверный логин или пароль');
        }
        $u = pub($row); if ($u['status'] === 'pending') fail(403, 'Заявка ещё не одобрена администратором.'); if ($u['status'] === 'banned') fail(403, 'Аккаунт заблокирован.');
        q('DELETE FROM rate WHERE ip=?', [$ip]); q('DELETE FROM sessions WHERE ts<?', [ms() - 2592000000]);
        $t = bin2hex(random_bytes(32)); q('INSERT INTO sessions (th,uid,ts) VALUES (?,?,?)', [hash('sha256', $t), $u['id'], ms()]);
        addlog($u['nickname'], $u['role'], 'Вошёл в систему', 'auth'); out(200, ['token' => $t]);
    }
    fail(400, 'Неизвестное действие');
}

// ---------- СОСТОЯНИЕ (только то, что разрешено роли) ----------
function state() {
    $u = me(); $P = perms($u); $has = fn($p) => in_array($p, $P, true); $s = settings();
    $db = ['settings' => $s, 'roles' => cl('roles'), 'sections' => cl('sections'), 'questions' => [], 'tests' => [], 'groups' => [], 'news' => [], 'faq' => [], 'results' => [], 'tickets' => [], 'logs' => [], 'users' => [], 'music' => []];
    if ($u && (empty($s['maintenance']) || $has('site.manage'))) {
        $mine = $u['groups']; $tests = array_values(array_filter(cl('tests'), fn($t) => empty($t['groupCode']) || in_array($t['groupCode'], $mine, true) || $has('tests.manage')));
        $db['tests'] = $tests;
        $qs = cl('questions'); if (!$has('questions.manage')) { $ids = []; foreach ($tests as $t) foreach (($t['questionIds'] ?? []) as $i) $ids[$i] = 1; $qs = array_values(array_filter($qs, fn($x) => isset($ids[$x['id']]))); }
        $db['questions'] = $qs;
        $mem = []; foreach (q('SELECT * FROM users')->fetchAll() as $ur) { $ux = pub($ur); if ($ux['status'] !== 'active') continue; foreach ($ux['groups'] as $gc) $mem[$gc][] = ['id' => $ux['id'], 'nickname' => $ux['nickname']]; }
        $db['groups'] = array_values(array_map(fn($g) => $g + ['members' => $mem[$g['code']] ?? []], array_filter(cl('groups'), fn($g) => $has('groups.manage') || in_array($g['code'], $mine, true))));
        $db['news'] = cl('news'); $db['faq'] = cl('faq'); $db['music'] = cl('music');
        $db['results'] = array_values(array_filter(cl('results'), fn($r) => $has('results.viewAll') || $r['userId'] === $u['id']));
        $db['tickets'] = array_values(array_filter(cl('tickets'), fn($t) => $has('tickets.manage') || $t['userId'] === $u['id']));
        if ($has('logs.view')) $db['logs'] = cl('logs');
        $mg = $has('users.manage');
        foreach (q('SELECT * FROM users')->fetchAll() as $r) { $x = pub($r); if (!$mg && $x['status'] !== 'active') continue; if (!$mg) { $x['username'] = ''; if ($x['id'] !== $u['id']) $x['groups'] = []; } $db['users'][] = $x; }
    } elseif ($u) { $db['users'] = [$u]; }
    out(200, ['db' => $db, 'user' => $u]);
}

// ---------- ЗАПИСЬ ИЗМЕНЕНИЙ с проверкой прав ----------
function groupCodes() { return array_map(fn($g) => $g['code'], cl('groups')); }
function devCount() { $n = 0; foreach (q('SELECT * FROM users')->fetchAll() as $r) if (pub($r)['role'] === 'dev') $n++; return $n; }
function syncUsers($d) {
    $me = needMe(); $mg = can('users.manage'); $codes = groupCodes(); $myP = perms($me);
    foreach (($d['up'] ?? []) as $x) {
        $row = q('SELECT * FROM users WHERE id=?', [str($x['id'] ?? '', 40)])->fetch(); if (!$row) fail(403, 'Создание пользователей — только через регистрацию');
        $cur = pub($row); $self = $cur['id'] === $me['id']; if (!$self && !$mg) fail(403, 'Нет права управлять пользователями');
        if (!$self && $cur['role'] === 'dev' && $me['role'] !== 'dev') fail(403, 'Аккаунт разработчика может изменять только разработчик');
        $n = $cur; $n['fullName'] = str($x['fullName'] ?? $cur['fullName'], 100);
        $nick = str($x['nickname'] ?? $cur['nickname'], 32);
        if ($nick !== $cur['nickname']) { if (mb_strlen($nick) < 3) fail(400, 'Никнейм — от 3 символов'); if (q('SELECT 1 FROM users WHERE LOWER(nickname)=LOWER(?) AND id<>?', [$nick, $cur['id']])->fetch()) fail(409, 'Никнейм уже занят'); }
        $grp = array_values(array_unique(array_filter(array_map('strval', (array)($x['groups'] ?? [])), fn($c) => in_array($c, $codes, true))));
        if ($self && !$mg) { $n['groups'] = array_values(array_unique(array_merge($cur['groups'], array_diff($grp, $cur['groups'])))); }
        else { $n['groups'] = $grp; }
        if (!$self && $mg) {
            $role = str($x['role'] ?? $cur['role'], 40); $r = cget('roles', $role); if (!$r) fail(400, 'Роль не найдена');
            if ($cur['role'] === 'dev' && $role !== 'dev' && devCount() <= 1) fail(400, 'Нельзя снять права с последнего разработчика');
            if ($role !== $cur['role'] && array_diff($r['permissions'] ?? [], $myP)) fail(403, 'Нельзя выдать роль с правами больше своих');
            $st = $x['status'] ?? $cur['status']; if (!in_array($st, ['active', 'banned', 'pending'], true)) fail(400, 'Неверный статус');
            $n['role'] = $role; $n['status'] = $st; if ($st !== 'active') q('DELETE FROM sessions WHERE uid=?', [$cur['id']]);
        }
        q('UPDATE users SET nickname=?, data=? WHERE id=?', [$nick, udata($n), $cur['id']]);
    }
    foreach (($d['del'] ?? []) as $id) {
        if (!$mg) fail(403, 'Нет права удалять пользователей'); if ($id === $me['id']) fail(400, 'Нельзя удалить себя');
        $tr = q('SELECT * FROM users WHERE id=?', [$id])->fetch();
        if ($tr && pub($tr)['role'] === 'dev') { if ($me['role'] !== 'dev') fail(403, 'Аккаунт разработчика может удалить только разработчик'); if (devCount() <= 1) fail(400, 'Нельзя удалить последнего разработчика'); }
        q('DELETE FROM users WHERE id=?', [$id]); q('DELETE FROM sessions WHERE uid=?', [$id]);
    }
}
function grade($t, $ans, $ids = null) { return gradeFull($t, $ans, $ids)['pct']; }
function gradeFull($t, $ans, $ids = null) {
    $qs = []; foreach (cl('questions') as $q) $qs[$q['id']] = $q; $ok = 0; $n = 0;
    foreach (array_values(array_unique((array)($ids ?? ($t['questionIds'] ?? [])))) as $id) {
        if (!isset($qs[$id])) continue; $n++; $q = $qs[$id]; $f = fn($x) => mb_strtolower(trim((string)$x));
        $a = array_map($f, (array)($ans[$id] ?? [])); $c = array_map($f, (array)($q['correct'] ?? []));
        if (($q['type'] ?? '') === 'TEXT') { if (isset($a[0]) && $a[0] !== '' && in_array($a[0], $c, true)) $ok++; }
        elseif (count($a) === count($c) && !array_diff($a, $c)) $ok++;
    }
    return ['ok' => $ok, 'n' => $n, 'pct' => (int)round($ok / max($n, 1) * 100)];
}
function sync() {
    $me = needMe(); $s = settings(); if (!empty($s['maintenance']) && !can('site.manage')) fail(503, 'Технические работы на сайте');
    $ch = body()['changes'] ?? []; db()->beginTransaction();
    foreach ($ch as $c => $d) {
        if ($c === 'users') { syncUsers($d); continue; }
        if ($c === 'logs') {
            if (!empty($d['clear'])) { if (!can('logs.view')) fail(403, 'Нет права очищать журнал'); q("DELETE FROM coll WHERE c='logs'"); addlog($me['nickname'], $me['role'], 'Очистил журнал действий', 'system'); continue; }
            foreach (($d['up'] ?? []) as $x) { if (cget('logs', str($x['id'] ?? '', 48))) continue; $cat = in_array($x['category'] ?? '', ['auth','tests','content','users','sections','site','support','system'], true) ? $x['category'] : 'system'; addlog($me['nickname'], $me['role'], $x['action'] ?? '', $cat); }
            continue;
        }
        if ($c === 'results') {
            foreach (($d['up'] ?? []) as $x) {
                $id = str($x['id'] ?? '', 48); if (cget('results', $id)) continue; if (!can('tests.take')) fail(403, 'Нет права проходить тесты');
                $t = cget('tests', str($x['testId'] ?? '', 48)); if (!$t) fail(400, 'Тест не найден');
                if (!empty($t['isBlocked'])) fail(403, 'Тест заблокирован');
                if (!empty($t['groupCode']) && !in_array($t['groupCode'], $me['groups'], true) && !can('tests.manage')) fail(403, 'Нет доступа к тесту');
                $max = (int)($t['maxAttempts'] ?? 0); if ($max > 0 && count(array_filter(cl('results'), fn($r) => $r['userId'] === $me['id'] && $r['testId'] === $t['id'])) >= $max) fail(403, 'Лимит попыток исчерпан');
                $ans = []; foreach ((array)($x['answers'] ?? []) as $qid => $a) $ans[str($qid, 48)] = array_slice(array_map(fn($v) => str($v, 300), (array)$a), 0, 20);
                $ex = array_values(array_filter(array_unique(array_filter((array)($t['questionIds'] ?? []), 'is_string')), fn($qid) => (bool)cget('questions', $qid)));
                $seenT = []; $ex2 = []; foreach ($ex as $qid) { $qq = cget('questions', $qid); $tk = mb_strtolower(preg_replace('/\s+/u', ' ', trim((string)($qq['title'] ?? '')))); if (isset($seenT[$tk])) continue; $seenT[$tk] = 1; $ex2[] = $qid; } $ex = $ex2;
                $lim = (int)($t['questionLimit'] ?? 0); $exp = ($lim > 0 && $lim < count($ex)) ? $lim : count($ex); $qids = null;
                if (isset($x['qids']) && is_array($x['qids'])) {
                    $qids = array_values(array_unique(array_intersect(array_map(fn($v) => str($v, 48), $x['qids']), $ex)));
                    if (count($qids) !== $exp) fail(400, 'Некорректный набор вопросов');
                }
                $fv = []; foreach ((array)($x['form'] ?? []) as $z) if (is_array($z)) $fv[str($z['id'] ?? '', 48)] = str($z['value'] ?? '', 300);
                $form = [];
                foreach ((array)($t['preFields'] ?? []) as $f) {
                    $fid = str($f['id'] ?? '', 48); $v = $fv[$fid] ?? '';
                    if ($v === '') fail(400, 'Заполните анкету перед тестом');
                    if (($f['type'] ?? '') === 'select' && !in_array($v, array_map('strval', (array)($f['options'] ?? [])), true)) fail(400, 'Некорректный вариант в анкете');
                    $form[] = ['id' => $fid, 'label' => str($f['label'] ?? '', 120), 'value' => $v];
                }
                $g = gradeFull($t, $ans, $qids); $score = $g['pct']; $passed = $score >= (int)($t['passScore'] ?? 0);
                $cn = cget('meta', 'counters') ?: []; $num = (int)($cn['result'] ?? 0) + 1; $cn['result'] = $num; cput('meta', 'counters', $cn, 0);
                $code = 'T-' . str_pad((string)$num, 5, '0', STR_PAD_LEFT);
                cput('results', $id, ['id' => $id, 'userId' => $me['id'], 'testId' => $t['id'], 'nickname' => $me['nickname'], 'score' => $score, 'passed' => $passed, 'date' => iso(), 'answers' => $ans, 'form' => $form, 'qids' => $qids ?? [], 'correct' => $g['ok'], 'total' => $g['n'], 'num' => $num, 'code' => $code, 'testTitle' => str($t['title'] ?? '', 200)], -ms());
                $GLOBALS['INFO'][$id] = ['score' => $score, 'passed' => $passed, 'correct' => $g['ok'], 'total' => $g['n'], 'num' => $num, 'code' => $code];
            }
            if (!empty($d['del'])) { if (!can('results.viewAll')) fail(403, 'Нет права удалять результаты'); foreach ($d['del'] as $id) q("DELETE FROM coll WHERE c='results' AND id=?", [$id]); }
            continue;
        }
        if ($c === 'tickets') {
            foreach (($d['up'] ?? []) as $x) {
                $id = str($x['id'] ?? '', 48); $old = cget('tickets', $id);
                if ($old && $old['userId'] !== $me['id'] && !can('tickets.manage')) fail(403, 'Чужое обращение');
                $x['userId'] = $old ? $old['userId'] : $me['id']; $x['subject'] = str($x['subject'] ?? '', 200);
                $x['messages'] = array_slice(array_map(fn($m) => ['id' => str($m['id'] ?? uid('m'), 48), 'from' => str($m['from'] ?? '', 40), 'name' => str($m['name'] ?? '', 60), 'role' => str($m['role'] ?? '', 40), 'text' => str($m['text'] ?? '', 4000), 'date' => str($m['date'] ?? iso(), 40)], (array)($x['messages'] ?? [])), 0, 200);
                cput('tickets', $id, $x);
            }
            if (!empty($d['del'])) { if (!can('tickets.manage')) fail(403, 'Нет права удалять обращения'); foreach ($d['del'] as $id) q("DELETE FROM coll WHERE c='tickets' AND id=?", [$id]); }
            continue;
        }
        $perm = MANAGE[$c] ?? null; if (!$perm) fail(400, 'Неизвестный раздел данных'); if (!can($perm)) fail(403, 'Недостаточно прав для этого действия');
        foreach (($d['up'] ?? []) as $x) {
            $id = str($x['id'] ?? '', 48); if ($id === '') continue;
            if ($c === 'groups') { $gc = str($x['code'] ?? '', 48); if ($gc === '') continue; cput('groups', $id, ['id' => $id, 'name' => str($x['name'] ?? '', 80), 'code' => $gc, 'description' => str($x['description'] ?? '', 300), 'notice' => mb_substr(trim((string)($x['notice'] ?? '')), 0, 1500)]); continue; }
            if ($c === 'music') { $mu = (string)($x['url'] ?? ''); if (!preg_match('#^(https?://|uploads/)[^\s<>"\']{1,480}$#i', $mu) || strpos($mu, '..') !== false) fail(400, 'Ссылка на музыку должна начинаться с http(s):// или быть загруженным файлом'); cput('music', $id, ['id' => $id, 'title' => str($x['title'] ?? '', 120) ?: 'Без названия', 'url' => $mu, 'file' => !empty($x['file'])]); continue; }
            if ($c === 'settings') { $k = []; foreach (['siteName','siteIcon','bannerDim','bannerTitle','bannerSubtitle','bannerImage'] as $f) $k[$f] = (string)($x[$f] ?? ''); $k['maintenance'] = !empty($x['maintenance']); $k['registrationOpen'] = !isset($x['registrationOpen']) || !empty($x['registrationOpen']); $k['callsEnabled'] = !isset($x['callsEnabled']) || !empty($x['callsEnabled']); $k['requireApproval'] = !empty($x['requireApproval']);
                $k['announcement'] = str($x['announcement'] ?? '', 500); $k['announcementType'] = in_array($x['announcementType'] ?? '', ['info', 'ok', 'warn'], true) ? $x['announcementType'] : 'info'; $k['maintenanceText'] = str($x['maintenanceText'] ?? '', 300);
                $allow = ['background','foreground','card','card-foreground','popover','popover-foreground','primary','primary-foreground','secondary','muted','muted-foreground','accent','accent-foreground','destructive','border','input','ring','glow','ok','warn','sidebar-background','sidebar-foreground','radius','font-body','font-head','font-size']; $tv = [];
                foreach ((array)($x['themeVars'] ?? []) as $kk => $vv) if (in_array($kk, $allow, true) && preg_match('/^[#a-zA-Z0-9 .,%()\-\/\'"]{1,60}$/', (string)$vv)) $tv[$kk] = (string)$vv;
                $k['themeVars'] = $tv ?: new stdClass(); $k['customCss'] = mb_substr(str_ireplace(['</style', '<script'], '', (string)($x['customCss'] ?? '')), 0, 12000);
                cput('settings', 'main', $k, 0); continue; }
            if ($c === 'roles' && $id === 'dev') { $x['permissions'] = ALLP; $x['system'] = true; }
            if ($c === 'roles') $x['permissions'] = array_values(array_intersect(ALLP, (array)($x['permissions'] ?? [])));
            $x['id'] = $id; cput($c, $id, $x);
        }
        foreach (($d['del'] ?? []) as $id) { $o = cget($c, $id); if ($c === 'music' && $o && !empty($o['file']) && strpos((string)$o['url'], 'uploads/') === 0 && strpos((string)$o['url'], '..') === false) @unlink(__DIR__ . '/' . $o['url']); if ($c === 'roles' && $o && !empty($o['system'])) fail(400, 'Системную роль удалить нельзя'); if ($c === 'sections' && $o && !empty($o['builtin']) && $id === 'dev') fail(400, 'Панель разработчика удалить нельзя'); q('DELETE FROM coll WHERE c=? AND id=?', [$c, $id]);
            if ($c === 'tests') foreach (cl('results') as $rr) if (($rr['testId'] ?? '') === $id) q("DELETE FROM coll WHERE c='results' AND id=?", [$rr['id']]); }
        if ($c !== 'settings' && isset($d['order'])) foreach (array_values((array)$d['order']) as $i => $id) q('UPDATE coll SET pos=? WHERE c=? AND id=?', [$i, $c, $id]);
    }
    db()->commit(); out(200, ['ok' => true, 'info' => $GLOBALS['INFO'] ?? new stdClass()]);
}

// ---------- РЕЙТИНГ ----------
function leaderboard($tid = '') {
    $nick = []; foreach (q('SELECT id,nickname FROM users')->fetchAll() as $r) $nick[$r['id']] = $r['nickname'];
    $g = [];
    foreach (cl('results') as $r) {
        if ($tid !== '' && ($r['testId'] ?? '') !== $tid) continue;
        $k = $r['userId'] ?? ''; if ($k === '') continue;
        if (!isset($g[$k])) $g[$k] = ['nickname' => $nick[$k] ?? ($r['nickname'] ?? '?'), 'attempts' => 0, 'passed' => 0, 'sum' => 0, 'best' => 0, 'tests' => []];
        $g[$k]['attempts']++; $g[$k]['passed'] += !empty($r['passed']) ? 1 : 0; $g[$k]['sum'] += (int)($r['score'] ?? 0);
        $g[$k]['best'] = max($g[$k]['best'], (int)($r['score'] ?? 0)); $g[$k]['tests'][$r['testId'] ?? ''] = 1;
    }
    $rows = array_map(fn($x) => ['nickname' => $x['nickname'], 'attempts' => $x['attempts'], 'passed' => $x['passed'], 'best' => $x['best'], 'avg' => (int)round($x['sum'] / max($x['attempts'], 1)), 'tests' => count($x['tests'])], array_values($g));
    usort($rows, fn($a, $b) => [$b['attempts'], $b['avg']] <=> [$a['attempts'], $a['avg']]);
    return array_slice($rows, 0, 100);
}
function leaderboardRoute() {
    needMe(); if (!empty(settings()['maintenance']) && !can('site.manage')) fail(503, 'Технические работы на сайте');
    out(200, ['rows' => leaderboard(str($_GET['test'] ?? '', 48))]);
}

// ---------- РЕЗЕРВНЫЕ КОПИИ ----------
function dump_all() {
    return ['format' => 'testpad-backup-v1', 'created' => iso(), 'users' => q('SELECT id,username,nickname,pass,data FROM users')->fetchAll(), 'coll' => q("SELECT c,id,pos,data FROM coll WHERE c NOT IN ('rsig','rmem','notif')")->fetchAll()];
}
function save_backup_file() {
    $dir = __DIR__ . '/backups'; if (!is_dir($dir)) @mkdir($dir, 0755, true);
    @file_put_contents($dir . '/.htaccess', "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
    $f = 'db-' . gmdate('Y-m-d_H-i-s') . '.json';
    if (@file_put_contents("$dir/$f", json_encode(dump_all(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR)) === false) fail(500, 'Нет прав на запись в папку backups рядом с api.php');
    $l = glob("$dir/db-*.json") ?: []; sort($l); while (count($l) > 20) @unlink(array_shift($l));
    return $f;
}
function backupRoute() {
    $me = needMe(); if (!can('backup.manage')) fail(403, 'Нет права на резервные копии');
    $d = dump_all(); addlog($me['nickname'], $me['role'], 'Скачал резервную копию с сервера', 'system'); out(200, $d);
}
function restoreRoute() {
    $me = needMe(); if (!can('backup.manage')) fail(403, 'Нет права на резервные копии');
    $d = body();
    if (($d['format'] ?? '') !== 'testpad-backup-v1' || !is_array($d['users'] ?? null) || !is_array($d['coll'] ?? null) || !$d['users']) fail(400, 'Файл не похож на серверную резервную копию (скачайте её кнопкой «Скачать копию с сервера»)');
    save_backup_file();
    db()->beginTransaction();
    q('DELETE FROM users'); q('DELETE FROM coll');
    foreach ($d['users'] as $u) q('INSERT INTO users (id,username,nickname,pass,data) VALUES (?,?,?,?,?)', [str($u['id'] ?? '', 40), str($u['username'] ?? '', 64), str($u['nickname'] ?? '', 64), (string)($u['pass'] ?? ''), (string)($u['data'] ?? '{}')]);
    foreach ($d['coll'] as $r) q('INSERT INTO coll (c,id,pos,data) VALUES (?,?,?,?)', [str($r['c'] ?? '', 32), str($r['id'] ?? '', 48), (int)($r['pos'] ?? 0), (string)($r['data'] ?? '{}')]);
    q('DELETE FROM sessions WHERE uid NOT IN (SELECT id FROM users)');
    db()->commit();
    addlog($me['nickname'], $me['role'], 'Восстановил базу из резервной копии', 'system'); out(200, ['ok' => true]);
}

// ---------- КОНСОЛЬ ----------
const HELP = "Команды (аргументы с пробелами — в \"кавычках\"):
  help                           — эта справка
  unlock [ip]                    — снять блокировку входа (15 минут за попытки); без ip — у всех
  dupes                          — найти одинаковые вопросы в банке
  dedupe                         — удалить одинаковые вопросы (останется первый)
  stats                          — сводка по сайту
  top                            — рейтинг прохождений
  users                          — список пользователей
  user <логин>                   — подробности о пользователе
  roles                          — список ролей
  role <логин> <id роли>         — сменить роль пользователя
  fullaccess <логин>             — выдать полный доступ (роль «Разработчик»)
  access [логин]                 — показать права пользователя (без логина — ваши)
  announce [info|ok|warn] \"текст\" — плашка сверху сайта; announce off — убрать
  ban <логин> / unban <логин>    — заблокировать / разблокировать
  approve <логин>                — одобрить заявку
  deluser <логин>                — удалить пользователя
  resetpw <логин> <пароль>       — сменить пароль
  kick <логин>                   — завершить все сессии пользователя
  grant <логин> <КОД>            — добавить пользователя в группу по коду
  group add \"Название\" [КОД]     — создать группу
  tests                          — список тестов
  news \"Заголовок\" \"Текст\"       — опубликовать новость
  section add \"Название\" \"Текст\" — добавить раздел сайта
  section hide|show <название>   — скрыть / показать раздел
  faq add \"Вопрос\" \"Ответ\"       — добавить в FAQ
  maint on|off                   — режим техработ
  set <ключ> <значение>          — настройка: siteName, requireApproval
  results [N]                    — последние N результатов
  clearresults                   — удалить все результаты
  clearlogs                      — очистить журнал
  backup                         — создать резервную копию на сервере (папка backups)
  clear                          — очистить экран консоли";
function tokenize($s) { preg_match_all('/"([^"]*)"|(\S+)/u', $s, $m, PREG_SET_ORDER); return array_map(fn($x) => count($x) > 2 ? $x[2] : $x[1], $m); }
function tbool($v) { return in_array(mb_strtolower((string)$v), ['on', 'true', '1', 'yes', 'да'], true); }
function findUser($n) { $n = ltrim(trim((string)$n), '@'); if ($n === '') return null; $r = q('SELECT * FROM users WHERE LOWER(username)=LOWER(?) OR LOWER(nickname)=LOWER(?)', [$n, $n])->fetch(); return $r ?: null; }
function saveUser($row, $u, $pass = null) { q('UPDATE users SET pass=?, data=? WHERE id=?', [$pass ?? $row['pass'], udata($u), $row['id']]); }
function saveSettings($patch) { $s = settings(); foreach ($patch as $k => $v) $s[$k] = $v; cput('settings', 'main', $s, 0); }
function consoleRoute() {
    $me = needMe(); if (!can('console.use')) fail(403, 'Нет права на консоль');
    $a = tokenize(str(body()['cmd'] ?? '', 2000)); $cmd = mb_strtolower((string)array_shift($a));
    $o = fn($t) => out(200, ['output' => $t]); $lg = fn($t) => addlog($me['nickname'], $me['role'], '[консоль] ' . $t, 'system');
    $need = function ($n) use ($me) { $r = findUser($n); if (!$r) fail(404, "Пользователь «{$n}» не найден"); if ($r['id'] !== $me['id'] && pub($r)['role'] === 'dev' && $me['role'] !== 'dev') fail(403, 'Аккаунт разработчика может изменять только разработчик'); return $r; };
    $cnt = fn($c) => (int)q('SELECT COUNT(*) n FROM coll WHERE c=?', [$c])->fetch()['n'];
    switch ($cmd) {
        case '': $o('');
        case 'help': $o(HELP);
        case 'stats':
            $r = ['users' => (int)q('SELECT COUNT(*) n FROM users')->fetch()['n'], 'tests' => $cnt('tests'), 'questions' => $cnt('questions'), 'results' => $cnt('results'), 'tickets' => $cnt('tickets'), 'news' => $cnt('news'), 'sections' => $cnt('sections'), 'faq' => $cnt('faq'), 'groups' => $cnt('groups'), 'roles' => $cnt('roles'), 'sessions' => (int)q('SELECT COUNT(*) n FROM sessions')->fetch()['n'], 'maintenance' => !empty(settings()['maintenance']) ? 'true' : 'false'];
            $o(implode("\n", array_map(fn($k, $v) => "$k: $v", array_keys($r), $r)));
        case 'top': $l = []; foreach (array_slice(leaderboard(''), 0, 10) as $i => $e) $l[] = ($i + 1) . ". {$e['nickname']} — прохождений {$e['attempts']}, средний {$e['avg']}%"; $o($l ? implode("\n", $l) : 'Пока нет данных');
        case 'users': $o(implode("\n", array_map(function ($r) { $x = pub($r); return "@{$x['username']} [{$x['nickname']}] {$x['role']} {$x['status']}"; }, q('SELECT * FROM users ORDER BY username')->fetchAll())));
        case 'user':
            $r = $need($a[0] ?? ''); $x = pub($r); $n = count(array_filter(cl('results'), fn($z) => ($z['userId'] ?? '') === $x['id']));
            $o("@{$x['username']}\nNick: {$x['nickname']}\nИмя: {$x['fullName']}\nРоль: {$x['role']}\nСтатус: {$x['status']}\nГруппы: " . (implode(', ', $x['groups']) ?: '—') . "\nПрохождений: $n\nСоздан: {$x['createdAt']}");
        case 'roles': $o(implode("\n", array_map(fn($r) => "{$r['id']} — {$r['name']} (прав: " . count($r['permissions'] ?? []) . ')', cl('roles'))));
        case 'tests': $o(implode("\n", array_map(fn($t) => "{$t['id']} — {$t['title']}" . (!empty($t['isBlocked']) ? ' [заблокирован]' : ''), cl('tests'))) ?: 'Тестов нет');
        case 'role':
            $r = $need($a[0] ?? ''); $x = pub($r); $role = cget('roles', (string)($a[1] ?? '')); if (!$role) fail(404, 'Роль не найдена. Список: roles');
            if ($x['id'] === $me['id']) fail(400, 'Нельзя менять роль себе');
            if (array_diff($role['permissions'] ?? [], perms($me))) fail(403, 'Нельзя выдать роль с правами больше своих');
            $x['role'] = $role['id']; saveUser($r, $x); $lg("role {$x['username']} {$role['id']}"); $o("@{$x['username']} теперь «{$role['name']}»");
        case 'access': case 'fullaccess':
            if ($cmd === 'fullaccess' && !empty($a[0])) {
                if (array_diff(ALLP, perms($me))) fail(403, 'Выдать полный доступ может только тот, у кого он уже есть (разработчик)');
                $r = $need($a[0]); $x = pub($r);
                if ($x['id'] === $me['id']) $o('У вас уже полный доступ: роль «Разработчик», все ' . count(ALLP) . ' прав.');
                $x['role'] = 'dev'; $x['status'] = 'active'; saveUser($r, $x); $lg("fullaccess {$x['username']}");
                $o("@{$x['username']} получил полный доступ к сайту (роль «Разработчик», прав: " . count(ALLP) . ')');
            }
            $r = !empty($a[0]) ? $need($a[0]) : q('SELECT * FROM users WHERE id=?', [$me['id']])->fetch(); $x = pub($r); $rl = cget('roles', $x['role']);
            $P = $x['role'] === 'dev' ? ALLP : ($rl['permissions'] ?? []);
            $o("@{$x['username']} — роль «" . ($rl['name'] ?? $x['role']) . "»\nПрав: " . count($P) . ' из ' . count(ALLP) . "\n" . implode(', ', $P) . "\nНе хватает: " . (implode(', ', array_diff(ALLP, $P)) ?: '— ничего, полный доступ'));
        case 'announce':
            if (!can('site.manage')) fail(403, 'Нет права менять настройки сайта');
            $t = (string)($a[0] ?? '');
            if ($t === '') { $s = settings(); $o(($s['announcement'] ?? '') !== '' ? 'Сейчас на плашке: ' . $s['announcement'] : 'Плашка выключена. Использование: announce [info|ok|warn] "текст"  /  announce off'); }
            if (in_array(mb_strtolower($t), ['off', 'clear', 'выкл'], true)) { saveSettings(['announcement' => '']); $lg('плашка выключена'); $o('Плашка сверху убрана'); }
            $type = 'info'; if (in_array($t, ['info', 'ok', 'warn'], true) && isset($a[1])) { $type = $t; array_shift($a); }
            $txt = str(implode(' ', $a), 500); if ($txt === '') fail(400, 'announce [info|ok|warn] "текст"');
            saveSettings(['announcement' => $txt, 'announcementType' => $type]); $lg("плашка: $txt"); $o("Плашка сверху установлена: $txt");
        case 'ban':
            $r = $need($a[0] ?? ''); $x = pub($r); if ($x['id'] === $me['id']) fail(400, 'Нельзя заблокировать себя');
            $x['status'] = 'banned'; saveUser($r, $x); q('DELETE FROM sessions WHERE uid=?', [$x['id']]); $lg("ban {$x['username']}"); $o("@{$x['username']} заблокирован");
        case 'unlock':
            if (($a[0] ?? '') !== '') { $n = q('DELETE FROM rate WHERE ip=?', [$a[0]])->rowCount(); $lg("unlock {$a[0]}"); $o("Блокировка входа для {$a[0]} " . ($n ? 'снята' : 'не найдена')); }
            $n = q('DELETE FROM rate')->rowCount(); $lg('unlock all'); $o("Блокировки входа сняты у всех (записей: $n)");
        case 'dupes': case 'dedupe':
            $seen = []; $drop = [];
            foreach (cl('questions') as $qq) { $k = mb_strtolower(preg_replace('/\s+/u', ' ', trim((string)($qq['title'] ?? '')))); if (isset($seen[$k])) $drop[$qq['id']] = $seen[$k]; else $seen[$k] = $qq['id']; }
            if (!$drop) $o('Дубликатов вопросов нет');
            if ($cmd === 'dupes') $o('Одинаковых вопросов в банке: ' . count($drop) . '. Команда dedupe удалит копии и заменит их в тестах на первый вопрос.');
            foreach (cl('tests') as $tt) { $old = array_values((array)($tt['questionIds'] ?? [])); $ids = array_values(array_unique(array_map(fn($i) => $drop[$i] ?? $i, $old))); if ($ids !== $old) { $tt['questionIds'] = $ids; cput('tests', $tt['id'], $tt); } }
            foreach ($drop as $did => $keep) q("DELETE FROM coll WHERE c='questions' AND id=?", [$did]);
            $lg('dedupe ' . count($drop)); $o('Удалено одинаковых вопросов: ' . count($drop));
        case 'unban': case 'approve':
            $r = $need($a[0] ?? ''); $x = pub($r); $x['status'] = 'active'; saveUser($r, $x); $lg("$cmd {$x['username']}"); $o("@{$x['username']} активен");
        case 'deluser':
            $r = $need($a[0] ?? ''); if ($r['id'] === $me['id']) fail(400, 'Нельзя удалить себя');
            q('DELETE FROM users WHERE id=?', [$r['id']]); q('DELETE FROM sessions WHERE uid=?', [$r['id']]); $lg("deluser {$r['username']}"); $o('Удалён');
        case 'resetpw':
            $r = $need($a[0] ?? ''); if (mb_strlen((string)($a[1] ?? '')) < 6) fail(400, 'Пароль не короче 6 символов');
            saveUser($r, pub($r), password_hash($a[1], PASSWORD_DEFAULT)); q('DELETE FROM sessions WHERE uid=?', [$r['id']]); $lg("resetpw {$r['username']}"); $o('Пароль изменён, сессии пользователя завершены');
        case 'kick':
            $r = $need($a[0] ?? ''); $n = q('DELETE FROM sessions WHERE uid=?', [$r['id']])->rowCount(); $o("Завершено сессий: $n");
        case 'grant':
            $r = $need($a[0] ?? ''); $x = pub($r); $code = null; foreach (cl('groups') as $g) if (mb_strtolower($g['code']) === mb_strtolower((string)($a[1] ?? ''))) $code = $g['code'];
            if ($code === null) fail(404, 'Группа с таким кодом не найдена');
            if (!in_array($code, $x['groups'], true)) $x['groups'][] = $code; saveUser($r, $x); $lg("grant {$x['username']} $code"); $o('Доступ выдан');
        case 'group':
            if (($a[0] ?? '') !== 'add' || empty($a[1])) fail(400, 'group add "Название" [КОД]');
            $code = $a[2] ?? ('INV-' . strtoupper(bin2hex(random_bytes(2))) . '-2026'); foreach (cl('groups') as $g) if (mb_strtolower($g['code']) === mb_strtolower($code)) fail(409, 'Код занят');
            $id = uid('g'); cput('groups', $id, ['id' => $id, 'code' => $code, 'name' => $a[1], 'description' => '']); $lg("группа {$a[1]}"); $o("Группа создана, код: $code");
        case 'news':
            if (empty($a[0]) || empty($a[1])) fail(400, 'news "Заголовок" "Текст"');
            $id = uid('n'); cput('news', $id, ['id' => $id, 'title' => $a[0], 'text' => $a[1], 'author' => $me['nickname'], 'date' => iso(), 'pinned' => false], -ms()); $lg("новость {$a[0]}"); $o('Новость опубликована');
        case 'section':
            $sub = $a[0] ?? '';
            if ($sub === 'add') {
                if (empty($a[1])) fail(400, 'section add "Название" "Текст"');
                $mx = 0; foreach (cl('sections') as $s) $mx = max($mx, (float)($s['order'] ?? 0)); $id = uid('s_');
                cput('sections', $id, ['id' => $id, 'title' => $a[1], 'icon' => 'BookOpen', 'order' => $mx + 1, 'visible' => true, 'roles' => [], 'builtin' => false, 'description' => '', 'content' => $a[2] ?? '']); $lg("раздел {$a[1]}"); $o('Раздел добавлен');
            }
            if ($sub === 'hide' || $sub === 'show') {
                foreach (cl('sections') as $s) if (mb_strtolower($s['title']) === mb_strtolower((string)($a[1] ?? ''))) { if ($s['id'] === 'dev' && $sub === 'hide') fail(400, 'Панель разработчика скрыть нельзя'); $s['visible'] = $sub === 'show'; cput('sections', $s['id'], $s); $lg("section $sub {$s['title']}"); $o('Готово'); }
                fail(404, 'Раздел не найден');
            }
            fail(400, 'section add|hide|show ...');
        case 'faq':
            if (($a[0] ?? '') !== 'add' || empty($a[1]) || empty($a[2])) fail(400, 'faq add "Вопрос" "Ответ"');
            $id = uid('f'); cput('faq', $id, ['id' => $id, 'q' => $a[1], 'a' => $a[2]]); $lg("faq {$a[1]}"); $o('Добавлено в FAQ');
        case 'maint': $v = tbool($a[0] ?? ''); saveSettings(['maintenance' => $v]); $lg('техработы: ' . ($v ? 'вкл' : 'выкл')); $o('Режим техработ: ' . ($v ? 'ВКЛ' : 'выкл'));
        case 'set':
            $k = $a[0] ?? ''; $v = implode(' ', array_slice($a, 1));
            if ($k === 'siteName') saveSettings(['siteName' => str($v, 60) ?: settings()['siteName']]);
            elseif ($k === 'requireApproval') saveSettings([$k => tbool($v)]);
            else fail(400, 'Ключи: siteName, requireApproval');
            $s = settings(); $lg("set $k"); $o("$k = " . (is_bool($s[$k]) ? ($s[$k] ? 'true' : 'false') : $s[$k]));
        case 'results':
            $n = min(50, max(1, (int)($a[0] ?? 10))); $tt = []; foreach (cl('tests') as $t) $tt[$t['id']] = $t['title'];
            $l = array_map(fn($r) => substr($r['date'] ?? '', 0, 16) . " {$r['nickname']} — " . ($tt[$r['testId']] ?? $r['testId']) . ": {$r['score']}%", array_slice(cl('results'), 0, $n)); $o($l ? implode("\n", $l) : 'Нет результатов');
        case 'clearresults': $n = $cnt('results'); q("DELETE FROM coll WHERE c='results'"); $lg('удалены все результаты'); $o("Удалено результатов: $n");
        case 'clearlogs': q("DELETE FROM coll WHERE c='logs'"); $lg('журнал очищен'); $o('Журнал очищен');
        case 'backup': if (!can('backup.manage')) fail(403, 'Нет права на резервные копии'); $f = save_backup_file(); $lg("backup $f"); $o("Создана копия: backups/$f");
        default: fail(400, "Неизвестная команда «{$cmd}». Введите help");
    }
}

// ---------- ЧАТ ----------
function chatRoute() {
    $me = needMe(); if (!empty(settings()['maintenance']) && !can('site.manage')) fail(503, 'Технические работы на сайте');
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $b = body(); $act = $b['action'] ?? '';
        if ($act === 'send') {
            $t = trim((string)preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', (string)($b['text'] ?? '')));
            if ($t === '') fail(400, 'Пустое сообщение');
            $t = mb_substr($t, 0, 1000);
            foreach (q("SELECT data FROM coll WHERE c='chat' ORDER BY pos ASC LIMIT 30")->fetchAll() as $r) {
                $m = json_decode($r['data'], true);
                if (($m['userId'] ?? '') === $me['id']) { if (ms() - (int)($m['ts'] ?? 0) < 1200) fail(429, 'Слишком часто. Подождите секунду.'); break; }
            }
            $men = mentions_of($t, $me); $id = uid('c_'); cput('chat', $id, ['id' => $id, 'userId' => $me['id'], 'nickname' => $me['nickname'], 'text' => $t, 'date' => iso(), 'ts' => ms(), 'mentions' => $men], -ms());
            if ($men) notify($men, 'mention', $me['nickname'] . ' упомянул(а) вас в чате', mb_substr($t, 0, 140), ['url' => 'chat']);
            q("DELETE FROM coll WHERE c='chat' AND pos > (SELECT pos FROM (SELECT pos FROM coll WHERE c='chat' ORDER BY pos ASC LIMIT 1 OFFSET 499) t)");
            out(200, ['ok' => true]);
        }
        if ($act === 'delete') {
            $m = cget('chat', str($b['id'] ?? '', 48)); if (!$m) fail(404, 'Сообщение не найдено');
            if (($m['userId'] ?? '') !== $me['id'] && !can('users.manage')) fail(403, 'Можно удалять только свои сообщения');
            q("DELETE FROM coll WHERE c='chat' AND id=?", [$m['id']]);
            if (($m['userId'] ?? '') !== $me['id']) addlog($me['nickname'], $me['role'], 'Удалил сообщение участника ' . ($m['nickname'] ?? '') . ' в чате', 'users');
            out(200, ['ok' => true]);
        }
        fail(400, 'Неизвестное действие');
    }
    $rows = q("SELECT data FROM coll WHERE c='chat' ORDER BY pos ASC LIMIT 100")->fetchAll();
    out(200, ['messages' => array_reverse(array_map(fn($r) => json_decode($r['data'], true), $rows))]);
}

// ---------- ЗВОНКИ (WebRTC, сигналы через опрос) ----------
function callRoute() {
    $me = needMe(); $s = settings();
    if (!empty($s['maintenance']) && !can('site.manage')) fail(503, 'Технические работы на сайте');
    $b = body(); $act = (string)($b['action'] ?? 'poll'); $now = ms(); $my = $me['id'];
    $pr = cget('presence', $my);
    if (!$pr || $now - (int)($pr['ts'] ?? 0) > 8000) cput('presence', $my, ['id' => $my, 'nickname' => $me['nickname'], 'role' => $me['role'], 'ts' => $now], 0);
    if ($act !== 'log' && isset($s['callsEnabled']) && !$s['callsEnabled']) out(200, ['enabled' => false, 'online' => [], 'incoming' => null, 'call' => null, 'ended' => null, 'signals' => [], 't' => 0]);
    $active = function () { $o = []; foreach (q("SELECT data FROM coll WHERE c='call' AND (data LIKE '%\"status\":\"ringing\"%' OR data LIKE '%\"status\":\"active\"%')")->fetchAll() as $r) $o[] = json_decode($r['data'], true); return $o; };
    $end = function ($c, $reason, $by = '') use ($now) { $c['status'] = 'ended'; $c['ended'] = $now; $c['reason'] = $reason; $c['endedBy'] = $by; cput('call', $c['id'], $c, -(int)$c['created']); return $c; };
    foreach ($active() as $c) {
        if ($c['status'] === 'ringing' && $now - (int)$c['created'] > 45000) { $end($c, 'missed'); notify([$c['to']], 'missed', 'Пропущенный звонок', 'Вам звонил ' . ($c['fromNick'] ?? ''), ['url' => 'phone']); continue; }
        if ($c['status'] === 'active') {
            $st = function ($u) use ($c, $now) { return $now - (int)($c['hb'][$u] ?? ($c['answered'] ?? $now)) > 25000; };
            if ($st($c['from']) || $st($c['to'])) $end($c, 'lost');
        }
    }
    $list = $active(); $busy = []; foreach ($list as $c) { $busy[$c['from']] = 1; $busy[$c['to']] = 1; }
    if ($act === 'start') {
        $to = str($b['to'] ?? '', 40); if ($to === '' || $to === $my) fail(400, 'Нельзя позвонить себе');
        $p2 = cget('presence', $to); if (!$p2 || $now - (int)($p2['ts'] ?? 0) > 30000) fail(409, 'Пользователь сейчас не в сети');
        if (isset($busy[$my])) fail(409, 'У вас уже идёт звонок'); if (isset($busy[$to])) fail(409, 'Пользователь занят');
        $id = uid('k_'); $c = ['id' => $id, 'from' => $my, 'fromNick' => $me['nickname'], 'to' => $to, 'toNick' => $p2['nickname'], 'status' => 'ringing', 'created' => $now, 'date' => iso()];
        cput('call', $id, $c, -$now); notify([$to], 'call', '📞 Входящий звонок', $me['nickname'] . ' звонит вам', ['url' => 'phone', 'call' => $id]); out(200, ['call' => $c]);
    }
    if (in_array($act, ['answer', 'end', 'signal'], true)) {
        $cid = str($b['id'] ?? '', 48); $c = $cid !== '' ? cget('call', $cid) : null;
        if (!$c || ($c['from'] !== $my && $c['to'] !== $my)) fail(404, 'Звонок не найден');
        $other = $c['from'] === $my ? $c['to'] : $c['from'];
        if ($act === 'answer') {
            if ($c['to'] !== $my || $c['status'] !== 'ringing') fail(409, 'Звонок уже неактуален');
            $c['status'] = 'active'; $c['answered'] = $now; $c['hb'] = [$c['from'] => $now, $c['to'] => $now]; cput('call', $cid, $c, -(int)$c['created']); out(200, ['call' => $c]);
        }
        if ($act === 'end') {
            if ($c['status'] !== 'ended') $end($c, $c['status'] === 'ringing' ? ($c['from'] === $my ? 'cancelled' : 'declined') : 'ended', $my);
            out(200, ['ok' => true]);
        }
        if ($c['status'] === 'ended') fail(409, 'Звонок завершён');
        $kind = (string)($b['kind'] ?? ''); if (!in_array($kind, ['offer', 'answer', 'ice'], true)) fail(400, 'Некорректный сигнал');
        $pl = (string)($b['payload'] ?? ''); if (strlen($pl) > 60000) fail(413, 'Слишком большой сигнал');
        $sid = uid('s_'); cput('callsig', $sid, ['id' => $sid, 'call' => $cid, 'from' => $my, 'to' => $other, 'kind' => $kind, 'payload' => $pl], (int)(microtime(true) * 1000000));
        out(200, ['ok' => true]);
    }
    if ($act === 'log') {
        $all = !empty($b['all']) && can('users.manage'); $o = [];
        foreach (q("SELECT data FROM coll WHERE c='call' ORDER BY pos ASC LIMIT 400")->fetchAll() as $r) {
            $c = json_decode($r['data'], true); if (($c['status'] ?? '') === 'ringing' || ($c['status'] ?? '') === 'active') continue;
            if ($all || $c['from'] === $my || $c['to'] === $my) { unset($c['hb']); $o[] = $c; if (count($o) >= ($all ? 100 : 30)) break; }
        }
        out(200, ['calls' => $o]);
    }
    $callId = str($b['call'] ?? '', 48); $endedInfo = null;
    if ($callId !== '') {
        $cc = cget('call', $callId);
        if ($cc && ($cc['from'] === $my || $cc['to'] === $my)) {
            if ($cc['status'] === 'active') { $cc['hb'][$my] = $now; cput('call', $callId, $cc, -(int)$cc['created']); }
            elseif ($cc['status'] === 'ended') $endedInfo = ['status' => 'ended', 'reason' => $cc['reason'] ?? 'ended', 'endedBy' => $cc['endedBy'] ?? ''];
        }
    }
    q("DELETE FROM coll WHERE c='callsig' AND pos < ?", [(int)(($now - 120000) * 1000)]);
    if (mt_rand(1, 40) === 1) q("DELETE FROM coll WHERE c='call' AND pos > (SELECT pos FROM (SELECT pos FROM coll WHERE c='call' ORDER BY pos ASC LIMIT 1 OFFSET 499) t)");
    $t = (int)(microtime(true) * 1000000); $since = isset($b['since']) ? (int)$b['since'] : null; $sigs = []; $next = $since ?? $t;
    if ($since !== null) foreach (q("SELECT data,pos FROM coll WHERE c='callsig' AND pos > ? ORDER BY pos ASC", [$since])->fetchAll() as $r) {
        $sg = json_decode($r['data'], true); if (($sg['to'] ?? '') !== $my) continue;
        $sg['pos'] = (int)$r['pos']; $sigs[] = $sg; $next = max($next, (int)$r['pos']);
    }
    $mine = null; $incoming = null;
    foreach ($list as $c) { if ($c['status'] === 'ended') continue; if ($c['to'] === $my && $c['status'] === 'ringing') $incoming = $c; if ($c['from'] === $my || $c['to'] === $my) $mine = $c; }
    if ($mine) unset($mine['hb']);
    $online = [];
    foreach (q("SELECT data FROM coll WHERE c='presence'")->fetchAll() as $r) {
        $pp = json_decode($r['data'], true); if (($pp['id'] ?? '') === $my || $now - (int)($pp['ts'] ?? 0) > 30000) continue;
        $online[] = ['id' => $pp['id'], 'nickname' => $pp['nickname'], 'role' => $pp['role'], 'busy' => isset($busy[$pp['id']])];
    }
    out(200, ['enabled' => true, 'me' => $my, 'online' => $online, 'incoming' => $incoming, 'call' => $mine, 'ended' => $endedInfo, 'signals' => $sigs, 't' => $next]);
}

// ---------- АДМИНИСТРИРОВАНИЕ ----------
function adminRoute() {
    $me = needMe(); if (!can('users.manage')) fail(403, 'Нет права управлять пользователями');
    $b = body(); $act = (string)($b['action'] ?? ''); $isDev = ($me['role'] ?? '') === 'dev';
    $target = function () use ($b, $isDev) {
        $r = q('SELECT * FROM users WHERE id=?', [str($b['id'] ?? '', 64)])->fetch(); if (!$r) fail(404, 'Пользователь не найден');
        if ((pub($r)['role'] ?? '') === 'dev' && !$isDev) fail(403, 'Аккаунты разработчиков меняет только разработчик');
        return $r;
    };
    switch ($act) {
        case 'create':
            $un = str($b['username'] ?? '', 32); $nick = str($b['nickname'] ?? '', 32); $full = str($b['fullName'] ?? '', 100); $pw = (string)($b['password'] ?? ''); $role = str($b['role'] ?? 'student', 48);
            if (!preg_match('/^[A-Za-z0-9_]{3,32}$/', $un)) fail(400, 'Логин: 3–32 символа, латиница, цифры и _');
            if (mb_strlen($nick) < 3) fail(400, 'Никнейм — от 3 символов'); if (mb_strlen($pw) < 6) fail(400, 'Пароль — от 6 символов');
            if ($role !== 'dev' && !cget('roles', $role)) fail(400, 'Такой роли нет'); if ($role === 'dev' && !$isDev) fail(403, 'Роль разработчика выдаёт только разработчик');
            if (q('SELECT 1 FROM users WHERE LOWER(username)=LOWER(?) OR LOWER(nickname)=LOWER(?)', [$un, $nick])->fetch()) fail(409, 'Логин или никнейм уже занят');
            q('INSERT INTO users (id,username,nickname,pass,data) VALUES (?,?,?,?,?)', [uid('u_'), $un, $nick, password_hash($pw, PASSWORD_DEFAULT), udata(['fullName' => $full, 'role' => $role, 'status' => 'active', 'groups' => [], 'createdAt' => iso()])]);
            addlog($me['nickname'], $me['role'], "Создал аккаунт @$un", 'users'); out(200, ['ok' => true]);
        case 'setpass':
            $r = $target(); $pw = (string)($b['password'] ?? ''); if (mb_strlen($pw) < 6) fail(400, 'Пароль — от 6 символов');
            saveUser($r, pub($r), password_hash($pw, PASSWORD_DEFAULT));
            if ($r['id'] === $me['id']) q('DELETE FROM sessions WHERE uid=? AND th<>?', [$r['id'], hash('sha256', tok())]); else q('DELETE FROM sessions WHERE uid=?', [$r['id']]);
            addlog($me['nickname'], $me['role'], "Сменил пароль @{$r['username']}", 'users'); out(200, ['ok' => true]);
        case 'edit':
            $r = $target(); $x = pub($r); $nick = str($b['nickname'] ?? '', 32); $full = str($b['fullName'] ?? '', 100);
            if (mb_strlen($nick) < 3) fail(400, 'Никнейм — от 3 символов');
            if (q('SELECT 1 FROM users WHERE LOWER(nickname)=LOWER(?) AND id<>?', [$nick, $r['id']])->fetch()) fail(409, 'Никнейм уже занят');
            $x['fullName'] = $full; saveUser($r, $x); q('UPDATE users SET nickname=? WHERE id=?', [$nick, $r['id']]);
            addlog($me['nickname'], $me['role'], "Изменил данные @{$r['username']}", 'users'); out(200, ['ok' => true]);
        case 'kick':
            $r = $target(); $n = q('DELETE FROM sessions WHERE uid=?', [$r['id']])->rowCount(); out(200, ['ok' => true, 'n' => $n]);
        case 'kickall':
            $n = q('DELETE FROM sessions WHERE uid<>?', [$me['id']])->rowCount(); addlog($me['nickname'], $me['role'], 'Завершил сессии всех пользователей', 'system'); out(200, ['ok' => true, 'n' => $n]);
        case 'unlock':
            $n = q('DELETE FROM rate')->rowCount(); addlog($me['nickname'], $me['role'], 'Снял блокировки входа', 'system'); out(200, ['ok' => true, 'n' => $n]);
        case 'online':
            $now = ms(); $o = [];
            foreach (q("SELECT data FROM coll WHERE c='presence'")->fetchAll() as $r) { $pp = json_decode($r['data'], true); $age = $now - (int)($pp['ts'] ?? 0); if ($age <= 30000) $o[] = ['id' => $pp['id'], 'nickname' => $pp['nickname'], 'role' => $pp['role'], 'ago' => (int)round($age / 1000)]; }
            out(200, ['online' => $o]);
        case 'sysinfo':
            $up = 0; foreach (glob(__DIR__ . '/uploads/*') ?: [] as $f) if (is_file($f)) $up += filesize($f);
            $cnt = function ($c) { return (int)(q('SELECT COUNT(*) c FROM coll WHERE c=?', [$c])->fetch()['c'] ?? 0); };
            out(200, ['php' => PHP_VERSION, 'db' => db()->getAttribute(PDO::ATTR_DRIVER_NAME), 'users' => (int)(q('SELECT COUNT(*) c FROM users')->fetch()['c'] ?? 0), 'sessions' => (int)(q('SELECT COUNT(*) c FROM sessions')->fetch()['c'] ?? 0), 'results' => $cnt('results'), 'tests' => $cnt('tests'), 'questions' => $cnt('questions'), 'tracks' => $cnt('music'), 'uploadsBytes' => $up, 'freeBytes' => (int)@disk_free_space(__DIR__), 'uploadMax' => ini_get('upload_max_filesize'), 'postMax' => ini_get('post_max_size'), 'memory' => ini_get('memory_limit')]);
        default: fail(400, 'Неизвестное действие');
    }
}

// ---------- ЗАГРУЗКА МУЗЫКИ ----------
function uploadRoute() {
    $me = needMe(); if (!can('site.manage')) fail(403, 'Нет права загружать файлы');
    $f = $_FILES['file'] ?? null;
    if (!$f || ($f['error'] ?? -1) !== UPLOAD_ERR_OK) {
        $e = $f['error'] ?? -1;
        fail(400, ($e === UPLOAD_ERR_INI_SIZE || $e === UPLOAD_ERR_FORM_SIZE) ? 'Часть файла больше лимита сервера (upload_max_filesize = ' . ini_get('upload_max_filesize') . ')' : 'Файл не загружен');
    }
    $name = (string)($_POST['name'] ?? $f['name']); $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($ext, ['mp3', 'ogg', 'oga', 'wav', 'm4a', 'aac', 'flac', 'opus', 'webm'], true)) fail(400, 'Допустимы аудиофайлы: mp3, ogg, wav, m4a, aac, flac, opus, webm');
    $dir = __DIR__ . '/uploads'; if (!is_dir($dir)) @mkdir($dir, 0755, true);
    @file_put_contents($dir . '/.htaccess', "Options -Indexes\n<IfModule mod_authz_core.c>\n<FilesMatch \"\\.(php|phtml|phar|html?|js)$\">\nRequire all denied\n</FilesMatch>\n</IfModule>\n<IfModule !mod_authz_core.c>\n<FilesMatch \"\\.(php|phtml|phar|html?|js)$\">\nDeny from all\n</FilesMatch>\n</IfModule>\n");
    foreach (glob($dir . '/.p-*') ?: [] as $old) if (@filemtime($old) < time() - 3600) @unlink($old);
    $max = 30 * 1024 * 1024;
    $uidp = (string)($_POST['uid'] ?? '');
    if (!preg_match('/^[a-f0-9]{16}$/', $uidp)) {
        if ($f['size'] > $max) fail(400, 'Файл больше 30 МБ');
        $final = bin2hex(random_bytes(8)) . '.' . $ext;
        if (!@move_uploaded_file($f['tmp_name'], "$dir/$final")) fail(500, 'Не удалось сохранить файл (нет прав на запись в папку uploads рядом с api.php)');
        out(200, ['url' => 'uploads/' . $final, 'name' => str(pathinfo($name, PATHINFO_FILENAME), 120)]);
    }
    $idx = (int)($_POST['idx'] ?? -1); $total = (int)($_POST['total'] ?? 0);
    if ($total < 1 || $total > 60 || $idx < 0 || $idx >= $total) fail(400, 'Некорректная часть файла');
    if (!@move_uploaded_file($f['tmp_name'], "$dir/.p-$uidp-$idx")) fail(500, 'Не удалось сохранить файл (нет прав на запись в папку uploads рядом с api.php)');
    if ($idx < $total - 1) out(200, ['part' => $idx]);
    $final = bin2hex(random_bytes(8)) . '.' . $ext; $fh = @fopen("$dir/$final", 'wb'); $size = 0; $bad = '';
    if (!$fh) fail(500, 'Не удалось создать файл в папке uploads');
    for ($k = 0; $k < $total; $k++) {
        $pf = "$dir/.p-$uidp-$k";
        if (!is_file($pf)) { $bad = 'Потеряна часть файла, повторите загрузку'; break; }
        $size += filesize($pf); if ($size > $max) { $bad = 'Файл больше 30 МБ'; break; }
        fwrite($fh, (string)file_get_contents($pf));
    }
    fclose($fh);
    for ($k = 0; $k < $total; $k++) @unlink("$dir/.p-$uidp-$k");
    if ($bad !== '') { @unlink("$dir/$final"); fail(400, $bad); }
    out(200, ['url' => 'uploads/' . $final, 'name' => str(pathinfo($name, PATHINFO_FILENAME), 120)]);
}

// ---------- МИГРАЦИИ (безопасно запускаются при каждом обращении) ----------
function migrate() {
    $dev = cget('roles', 'dev');
    if (!$dev) cput('roles', 'dev', ['id' => 'dev', 'name' => 'Разработчик', 'color' => '26 51% 57%', 'system' => true, 'permissions' => ALLP]);
    elseif (($dev['permissions'] ?? []) !== ALLP) { $dev['permissions'] = ALLP; cput('roles', 'dev', $dev); }
    if (!cget('meta', 'sec_leaderboard')) {
        cput('meta', 'sec_leaderboard', ['done' => 1], 0);
        if (!cget('sections', 'leaderboard')) cput('sections', 'leaderboard', ['id' => 'leaderboard', 'title' => 'Рейтинг', 'icon' => 'Trophy', 'order' => 4.5, 'visible' => true, 'roles' => [], 'builtin' => true, 'description' => 'Кто прошёл больше всего тестов']);
    }
    if (!cget('meta', 'sec_phone')) {
        cput('meta', 'sec_phone', ['done' => 1], 0);
        if (!cget('sections', 'phone')) cput('sections', 'phone', ['id' => 'phone', 'title' => 'Звонки', 'icon' => 'Phone', 'order' => 9.7, 'visible' => true, 'roles' => [], 'builtin' => true, 'description' => 'Голосовые звонки между участниками']);
    }
    if (!cget('meta', 'sec_music')) {
        cput('meta', 'sec_music', ['done' => 1], 0);
        if (!cget('sections', 'music')) cput('sections', 'music', ['id' => 'music', 'title' => 'Музыка', 'icon' => 'Music', 'order' => 9.5, 'visible' => true, 'roles' => [], 'builtin' => true, 'description' => 'Плейлист сайта: фоновая музыка']);
    }
    if (!cget('meta', 'sec_calls')) {
        cput('meta', 'sec_calls', ['done' => 1], 0);
        if (!cget('sections', 'calls')) cput('sections', 'calls', ['id' => 'calls', 'title' => 'База обзвонов', 'icon' => 'Phone', 'order' => 4.8, 'visible' => true, 'roles' => ['dev'], 'builtin' => true, 'description' => 'ID прохождений, кандидаты и баллы']);
    }
    if (!cget('meta', 'sec_chat')) {
        cput('meta', 'sec_chat', ['done' => 1], 0);
        if (!cget('sections', 'chat')) cput('sections', 'chat', ['id' => 'chat', 'title' => 'Чат', 'icon' => 'MessageCircle', 'order' => 4.7, 'visible' => true, 'roles' => [], 'builtin' => true, 'description' => 'Общение участников']);
    }
}

// ---------- ТЕГИ, УВЕДОМЛЕНИЯ И PUSH ----------
function b64u($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }

// Кого упомянули в тексте через @ник (@all / @все — только у тех, кто управляет пользователями)
function mentions_of($t, $me) {
    $ids = [];
    $isAll = can('users.manage') && preg_match('/(^|\s)@(all|everyone|все|всем)(?![\p{L}\p{N}_])/iu', $t);
    foreach (q('SELECT * FROM users')->fetchAll() as $ur) {
        $x = pub($ur); if ($x['status'] !== 'active' || $x['id'] === $me['id']) continue;
        if ($isAll || preg_match('/(^|[^\p{L}\p{N}_])@' . preg_quote($x['nickname'], '/') . '(?![\p{L}\p{N}_])/iu', $t)) $ids[] = $x['id'];
    }
    return array_slice($ids, 0, 300);
}

// Ключи VAPID создаются один раз и хранятся в базе (coll: sec/vapid). Нужен openssl.
function vapid() {
    static $v = false; if ($v !== false) return $v; $v = null;
    if (!function_exists('openssl_pkey_new')) return $v;
    $r = cget('sec', 'vapid');
    if ($r && !empty($r['pem'])) return $v = $r;
    $k = @openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    if (!$k) return $v;
    openssl_pkey_export($k, $pem); $d = openssl_pkey_get_details($k);
    if (empty($d['ec']['x']) || empty($d['ec']['y'])) return $v;
    $r = ['pem' => $pem, 'pub' => b64u("\x04" . str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT))];
    cput('sec', 'vapid', $r, 0);
    return $v = $r;
}
function der2raw($der) {
    $o = 2; if (ord($der[1]) & 0x80) $o += ord($der[1]) & 0x7f;
    $rl = ord($der[$o + 1]); $r = substr($der, $o + 2, $rl); $o += 2 + $rl;
    $sl = ord($der[$o + 1]); $s = substr($der, $o + 2, $sl);
    return str_pad(ltrim($r, "\0"), 32, "\0", STR_PAD_LEFT) . str_pad(ltrim($s, "\0"), 32, "\0", STR_PAD_LEFT);
}
function push_jwt($endpoint, $v) {
    $u = parse_url($endpoint); $aud = ($u['scheme'] ?? 'https') . '://' . ($u['host'] ?? '') . (isset($u['port']) ? ':' . $u['port'] : '');
    $host = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''); if (strpos($host, '.') === false) $host = 'example.com';
    $in = b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256'])) . '.' . b64u(json_encode(['aud' => $aud, 'exp' => time() + 12 * 3600, 'sub' => 'mailto:admin@' . $host]));
    if (!openssl_sign($in, $der, $v['pem'], OPENSSL_ALGO_SHA256)) return '';
    return $in . '.' . b64u(der2raw($der));
}

// Создаёт уведомление каждому из $uids: оно видно на сайте и уходит push-ом на подписанные устройства.
function notify($uids, $type, $title, $body, $extra = []) {
    $uids = array_values(array_unique(array_filter((array)$uids))); if (!$uids) return;
    $now = ms(); $want = array_flip($uids);
    foreach ($uids as $u) { $id = uid('n_'); cput('notif', $id, ['id' => $id, 'to' => $u, 'type' => $type, 'title' => $title, 'body' => $body, 'ts' => $now] + $extra, $now); }
    if (mt_rand(1, 25) === 1) q("DELETE FROM coll WHERE c='notif' AND pos < ?", [$now - 3 * 86400000]);
    if (!vapid()) return;
    foreach (q("SELECT data FROM coll WHERE c='push'")->fetchAll() as $r) {
        $s = json_decode($r['data'], true);
        if ($s && isset($want[$s['uid'] ?? '']) && count($GLOBALS['PUSHQ'] ?? []) < 150) $GLOBALS['PUSHQ'][] = ['id' => $s['id'], 'endpoint' => $s['endpoint']];
    }
}
// Отправка "пустых" push (без шифрования): сервис-воркер сам забирает текст через ?r=notify (action=pending).
function push_flush() {
    $q = $GLOBALS['PUSHQ'] ?? []; if (!$q) return; $GLOBALS['PUSHQ'] = [];
    try {
        $v = vapid(); if (!$v || !function_exists('curl_init')) return;
        if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();
        @ignore_user_abort(true); @set_time_limit(20);
        $mh = curl_multi_init(); $hs = [];
        foreach ($q as $s) {
            $jwt = push_jwt($s['endpoint'], $v); if ($jwt === '') continue;
            $ch = curl_init($s['endpoint']);
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => '', CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 4,
                CURLOPT_HTTPHEADER => ['Authorization: vapid t=' . $jwt . ', k=' . $v['pub'], 'TTL: 3600', 'Urgency: high', 'Content-Length: 0']]);
            curl_multi_add_handle($mh, $ch); $hs[] = [$ch, $s];
        }
        $run = 0; do { curl_multi_exec($mh, $run); if ($run) curl_multi_select($mh, 1); } while ($run > 0);
        foreach ($hs as $h) {
            $code = (int)curl_getinfo($h[0], CURLINFO_HTTP_CODE);
            if ($code === 404 || $code === 410) q("DELETE FROM coll WHERE c='push' AND id=?", [$h[1]['id']]);
            curl_multi_remove_handle($mh, $h[0]); curl_close($h[0]);
        }
        curl_multi_close($mh);
    } catch (Throwable $e) { error_log('TESTPAD push: ' . $e->getMessage()); }
}
register_shutdown_function('push_flush');

function notifyRoute() {
    $b = body(); $act = (string)($b['action'] ?? ''); $now = ms();
    $pubn = fn($n) => ['id' => $n['id'], 'type' => $n['type'], 'title' => $n['title'], 'body' => $n['body'], 'ts' => $n['ts'], 'url' => $n['url'] ?? '', 'room' => $n['room'] ?? '', 'call' => $n['call'] ?? ''];
    if ($act === 'pending') { // вызывает сервис-воркер без сессии: подписка = секрет
        $ep = (string)($b['endpoint'] ?? ''); $sid = substr(sha1($ep), 0, 40); $s = $ep !== '' ? cget('push', $sid) : null;
        if (!$s || ($s['endpoint'] ?? '') !== $ep) out(200, ['items' => []]);
        $items = [];
        foreach (q("SELECT data FROM coll WHERE c='notif' AND pos > ? ORDER BY pos ASC LIMIT 50", [(int)($s['seen'] ?? 0)])->fetchAll() as $r) { $n = json_decode($r['data'], true); if (($n['to'] ?? '') === $s['uid']) $items[] = $pubn($n); }
        $s['seen'] = $now; cput('push', $sid, $s, 0);
        out(200, ['items' => $items]);
    }
    if ($act === 'unsubscribe') { $ep = (string)($b['endpoint'] ?? ''); if ($ep !== '') q("DELETE FROM coll WHERE c='push' AND id=?", [substr(sha1($ep), 0, 40)]); out(200, ['ok' => true]); }
    $me = needMe();
    if ($act === 'key') { $v = vapid(); out(200, ['key' => $v ? $v['pub'] : '']); }
    if ($act === 'subscribe') {
        $ep = (string)($b['endpoint'] ?? ''); if (strpos($ep, 'https://') !== 0 || strlen($ep) > 1200) fail(400, 'Некорректная подписка');
        $sid = substr(sha1($ep), 0, 40); cput('push', $sid, ['id' => $sid, 'uid' => $me['id'], 'endpoint' => $ep, 'ts' => $now, 'seen' => $now], 0);
        $mine = 0; foreach (q("SELECT data FROM coll WHERE c='push'")->fetchAll() as $r) { $x = json_decode($r['data'], true); if (($x['uid'] ?? '') === $me['id']) $mine++; }
        out(200, ['ok' => true, 'devices' => $mine]);
    }
    if ($act === 'test') { notify([$me['id']], 'test', 'Уведомления работают', 'Так будут выглядеть теги и звонки', ['url' => 'chat']); out(200, ['ok' => true, 'push' => (bool)vapid()]); }
    // poll: новые уведомления для открытой страницы
    $since = isset($b['since']) ? (int)$b['since'] : null; $items = [];
    if ($since !== null) foreach (q("SELECT data FROM coll WHERE c='notif' AND pos > ? ORDER BY pos ASC LIMIT 100", [$since])->fetchAll() as $r) { $n = json_decode($r['data'], true); if (($n['to'] ?? '') === $me['id']) $items[] = $pubn($n); }
    out(200, ['items' => array_slice($items, -20), 't' => $now, 'push' => (bool)vapid()]);
}

// ---------- ГРУППОВЫЕ ЗВОНКИ (комнаты, сеть WebRTC "каждый с каждым", до 8 человек) ----------
function roomRoute() {
    $me = needMe(); $s = settings(); $my = $me['id'];
    if (!empty($s['maintenance']) && !can('site.manage')) fail(503, 'Технические работы на сайте');
    if (isset($s['callsEnabled']) && !$s['callsEnabled']) out(200, ['enabled' => false, 'rooms' => [], 'members' => [], 'signals' => [], 't' => 0]);
    $b = body(); $act = (string)($b['action'] ?? 'poll'); $now = ms(); $MAX = 8;
    q("DELETE FROM coll WHERE c='rmem' AND pos < ?", [$now - 15000]);   // pos участника = время последнего пульса
    q("DELETE FROM coll WHERE c='rsig' AND pos < ?", [($now - 120000) * 1000]);
    if (mt_rand(1, 40) === 1) q("DELETE FROM coll WHERE c='room' AND pos > ?", [-($now - 86400000)]);
    $mid = fn($rid) => substr(sha1($rid . '|' . $my), 0, 40);
    $mems = function () { $o = []; foreach (q("SELECT data FROM coll WHERE c='rmem'")->fetchAll() as $r) { $m = json_decode($r['data'], true); if ($m) $o[$m['room']][] = $m; } return $o; };
    $ok = function ($r) use ($me, $my) {
        $sc = $r['scope'] ?? 'all'; if (($r['host'] ?? '') === $my || $sc === 'all') return true;
        if ($sc === 'group') return in_array($r['code'] ?? '', $me['groups'], true) || can('groups.manage');
        return in_array($my, $r['ids'] ?? [], true);
    };
    $all = $mems(); $mine = null; foreach ($all as $rid0 => $ml) foreach ($ml as $m) if ($m['uid'] === $my) $mine = $m;
    $newMem = fn($rid, $old = null) => ['room' => $rid, 'uid' => $my, 'nick' => $me['nickname'], 'joined' => $old['joined'] ?? $now, 'sharing' => !empty($b['sharing']), 'muted' => !empty($b['muted'])];

    if ($act === 'create') {
        if ($mine) fail(409, 'Вы уже участвуете в групповом звонке');
        $sc = (string)($b['scope'] ?? 'all'); if (!in_array($sc, ['all', 'group', 'ids'], true)) $sc = 'all';
        $code = ''; $ids = [];
        if ($sc === 'group') { $code = str($b['code'] ?? '', 40); if ($code === '' || (!in_array($code, $me['groups'], true) && !can('groups.manage'))) fail(403, 'Вы не состоите в этой группе'); }
        if ($sc === 'ids') { foreach ((array)($b['ids'] ?? []) as $i) { $i = str($i, 40); if ($i !== '' && $i !== $my) $ids[] = $i; } $ids = array_slice(array_values(array_unique($ids)), 0, 30); if (!$ids) $sc = 'all'; }
        $rid = uid('r_'); $name = str($b['name'] ?? '', 60); if ($name === '') $name = 'Групповой звонок';
        $room = ['id' => $rid, 'name' => $name, 'host' => $my, 'hostNick' => $me['nickname'], 'scope' => $sc, 'code' => $code, 'ids' => $ids, 'created' => $now, 'status' => 'active'];
        cput('room', $rid, $room, -$now);
        cput('rmem', $mid($rid), $newMem($rid), $now);
        $to = [];
        foreach (q('SELECT * FROM users')->fetchAll() as $ur) {
            $x = pub($ur); if ($x['status'] !== 'active' || $x['id'] === $my) continue;
            if ($sc === 'all' || ($sc === 'group' && in_array($code, $x['groups'], true)) || ($sc === 'ids' && in_array($x['id'], $ids, true))) $to[] = $x['id'];
        }
        notify($to, 'room', '📞 ' . $me['nickname'] . ' начал(а) групповой звонок', $name, ['url' => 'phone', 'room' => $rid]);
        if ($sc === 'all') { $cid = uid('c_'); cput('chat', $cid, ['id' => $cid, 'userId' => $my, 'nickname' => $me['nickname'], 'text' => '📞 Начал(а) групповой звонок «' . $name . '»', 'date' => iso(), 'ts' => $now, 'room' => $rid, 'mentions' => []], -$now); }
        out(200, ['room' => $room]);
    }
    if ($act === 'join') {
        $rid = str($b['id'] ?? '', 48); $room = $rid !== '' ? cget('room', $rid) : null;
        if (!$room || ($room['status'] ?? '') !== 'active') fail(404, 'Звонок уже завершён');
        if (!$ok($room)) fail(403, 'Нет доступа к этому звонку');
        if ($mine && $mine['room'] !== $rid) fail(409, 'Вы уже участвуете в другом групповом звонке');
        if (!$mine && count($all[$rid] ?? []) >= $MAX) fail(409, 'В звонке уже ' . $MAX . ' участников — это максимум');
        if (!$mine) cput('rmem', $mid($rid), $newMem($rid), $now);
        out(200, ['ok' => true]);
    }
    if ($act === 'leave') { q("DELETE FROM coll WHERE c='rmem' AND id=?", [$mid(str($b['id'] ?? '', 48))]); out(200, ['ok' => true]); }
    if ($act === 'signal') {
        $rid = str($b['id'] ?? '', 48); $to = str($b['to'] ?? '', 40); $kind = (string)($b['kind'] ?? '');
        if (!$mine || $mine['room'] !== $rid) fail(403, 'Вы не в этом звонке');
        if (!in_array($kind, ['offer', 'answer', 'ice'], true)) fail(400, 'Некорректный сигнал');
        $peer = false; foreach ($all[$rid] ?? [] as $m) if ($m['uid'] === $to) $peer = true;
        if (!$peer) fail(409, 'Участник уже вышел');
        $pl = (string)($b['payload'] ?? ''); if (strlen($pl) > 60000) fail(413, 'Слишком большой сигнал');
        $sid = uid('s_'); cput('rsig', $sid, ['id' => $sid, 'room' => $rid, 'from' => $my, 'to' => $to, 'kind' => $kind, 'payload' => $pl], (int)(microtime(true) * 1000000));
        out(200, ['ok' => true]);
    }
    // poll: пульс участника, список комнат, состав моей комнаты и сигналы
    $rid = str($b['room'] ?? '', 48); $kicked = false;
    if ($rid !== '') {
        if ($mine && $mine['room'] === $rid) { cput('rmem', $mid($rid), $newMem($rid, $mine), $now); foreach ($all[$rid] as $k => $m) if ($m['uid'] === $my) $all[$rid][$k] = $newMem($rid, $mine); }
        else $kicked = true;
    }
    $rooms = [];
    foreach (q("SELECT data FROM coll WHERE c='room' ORDER BY pos ASC LIMIT 60")->fetchAll() as $r) {
        $rm = json_decode($r['data'], true); if (!$rm || ($rm['status'] ?? '') !== 'active') continue;
        $ml = $all[$rm['id']] ?? [];
        if (!$ml && $now - (int)$rm['created'] > 8000) { $rm['status'] = 'ended'; $rm['ended'] = $now; cput('room', $rm['id'], $rm, -(int)$rm['created']); continue; }
        if (!$ok($rm)) continue;
        $rooms[] = ['id' => $rm['id'], 'name' => $rm['name'], 'host' => $rm['host'], 'hostNick' => $rm['hostNick'], 'scope' => $rm['scope'], 'code' => $rm['code'] ?? '', 'created' => $rm['created'], 'age' => $now - (int)$rm['created'], 'count' => count($ml), 'nicks' => array_map(fn($m) => $m['nick'], $ml)];
    }
    $members = [];
    if ($rid !== '' && !$kicked) foreach ($all[$rid] ?? [] as $m) $members[] = ['id' => $m['uid'], 'nick' => $m['nick'], 'joined' => (int)$m['joined'], 'sharing' => !empty($m['sharing']), 'muted' => !empty($m['muted'])];
    $t = (int)(microtime(true) * 1000000); $since = isset($b['since']) ? (int)$b['since'] : null; $sigs = []; $next = $since ?? $t;
    if ($since !== null) foreach (q("SELECT data,pos FROM coll WHERE c='rsig' AND pos > ? ORDER BY pos ASC", [$since])->fetchAll() as $r) {
        $sg = json_decode($r['data'], true); if (($sg['to'] ?? '') !== $my) continue;
        $next = max($next, (int)$r['pos']); if ($rid === '' || ($sg['room'] ?? '') !== $rid) continue;
        $sg['pos'] = (int)$r['pos']; $sigs[] = $sg;
    }
    out(200, ['enabled' => true, 'me' => $my, 'rooms' => $rooms, 'room' => $rid ?: null, 'kicked' => $kicked, 'members' => $members, 'signals' => $sigs, 't' => $next]);
}


install(); migrate();
switch ($_GET['r'] ?? '') {
    case 'auth': if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST'); auth(); break;
    case 'state': state(); break;
    case 'leaderboard': leaderboardRoute(); break;
    case 'backup': backupRoute(); break;
    case 'restore': if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST'); restoreRoute(); break;
    case 'console': if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST'); consoleRoute(); break;
    case 'chat': chatRoute(); break;
    case 'call': if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST'); callRoute(); break;
    case 'room': if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST'); roomRoute(); break;
    case 'notify': if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST'); notifyRoute(); break;
    case 'admin': if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST'); adminRoute(); break;
    case 'upload': if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST'); uploadRoute(); break;
    case 'sync': if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST'); sync(); break;
    default: fail(404, 'Метод не найден');
}
