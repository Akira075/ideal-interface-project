<?php
// TESTPAD STUDIO 4.0 — сервер для PHP-хостинга. Совместим с базой версии 3.7 (data/app.sqlite или MySQL).
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
ini_set('display_errors', '0');
if (!is_file(__DIR__ . '/config.php')) { http_response_code(500); echo json_encode(['error' => 'На сервере нет файла config.php рядом с api.php'], JSON_UNESCAPED_UNICODE); exit; }
$CFG = require __DIR__ . '/config.php';
if (!function_exists('mb_substr')) { function mb_substr($s, $a, $l = null) { $c = preg_split('//u', (string)$s, -1, PREG_SPLIT_NO_EMPTY) ?: []; return implode('', $l === null ? array_slice($c, $a) : array_slice($c, $a, $l)); } }
if (!function_exists('mb_strtolower')) { function mb_strtolower($s) { return strtolower((string)$s); } }
if (!function_exists('mb_strlen')) { function mb_strlen($s) { return count(preg_split('//u', (string)$s, -1, PREG_SPLIT_NO_EMPTY) ?: []); } }

const ALLP = ['tests.take','tests.manage','questions.manage','results.viewAll','groups.manage','news.manage','faq.manage','tickets.manage','users.manage','roles.manage','sections.manage','site.manage','logs.view','backup.manage','console.use'];
const MANAGE = ['roles' => 'roles.manage', 'sections' => 'sections.manage', 'questions' => 'questions.manage', 'tests' => 'tests.manage', 'groups' => 'groups.manage', 'news' => 'news.manage', 'faq' => 'faq.manage'];
const SITE_KEYS = ['siteName','siteIcon','bannerDim','bannerTitle','bannerSubtitle','bannerImage','footerText','footerLinks','maintenance','requireApproval','registrationOpen','maintenanceText','announcement','announcementType'];

function out($c, $v) { http_response_code($c); echo json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR); exit; }
function fail($c, $m) { out($c, ['error' => $m]); }
class DbError extends Exception {}
function dbfail($m) { throw new DbError($m); }
set_exception_handler(function ($e) {
    global $CFG;
    try { if (!empty($GLOBALS['DBOK']) && db()->inTransaction()) db()->rollBack(); } catch (Throwable $x) {}
    error_log('TESTPAD: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    out(500, ['error' => ($e instanceof DbError || !empty($CFG['debug'])) ? $e->getMessage() : 'Ошибка сервера (включите debug в config.php или откройте check.php)']);
});
function uid($p = '') { return $p . bin2hex(random_bytes(5)); }
function iso() { return gmdate('Y-m-d\TH:i:s') . '.000Z'; }
function ms() { return (int)round(microtime(true) * 1000); }
function str($v, $n = 300) { return is_scalar($v) ? mb_substr(trim((string)$v), 0, $n) : ''; }

function db_sqlite() {
    if (!extension_loaded('pdo_sqlite')) dbfail('На хостинге не включено расширение pdo_sqlite. Включите его или настройте MySQL в config.php.');
    $dir = __DIR__ . '/data'; if (!is_dir($dir)) @mkdir($dir, 0755, true);
    if (!is_dir($dir) || !is_writable($dir)) dbfail('Нет прав на запись в папку data рядом с api.php (поставьте 755/775/777).');
    @file_put_contents($dir . '/.htaccess', "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
    $p = new PDO('sqlite:' . $dir . '/app.sqlite'); $p->setAttribute(PDO::ATTR_TIMEOUT, 10); $p->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    @$p->exec('PRAGMA busy_timeout = 8000'); return $p;
}
function db_mysql() {
    global $CFG;
    if (!extension_loaded('pdo_mysql')) dbfail('На хостинге нет ни pdo_sqlite, ни pdo_mysql.');
    if (empty($CFG['name'])) dbfail('MySQL не настроен: впишите host, name, user, pass в config.php (или включите pdo_sqlite).');
    $last = null;
    foreach (array_values(array_unique([($CFG['host'] ?? '') ?: 'localhost', 'localhost', '127.0.0.1'])) as $h) {
        try { return new PDO("mysql:host=$h;dbname={$CFG['name']};charset=utf8mb4", $CFG['user'], $CFG['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
        catch (PDOException $e) { $last = $e; }
    }
    dbfail('Не удаётся подключиться к MySQL: ' . $last->getMessage());
}
function db() {
    static $p; if ($p) return $p; global $CFG; $d = $CFG['driver'] ?? 'auto';
    if ($d === 'sqlite') { $p = db_sqlite(); $GLOBALS['SQLITE'] = true; }
    elseif ($d === 'mysql') { $p = db_mysql(); $GLOBALS['SQLITE'] = false; }
    else {
        try { $p = db_sqlite(); $GLOBALS['SQLITE'] = true; }
        catch (Throwable $e) {
            if (empty($CFG['name'])) throw ($e instanceof DbError ? $e : new DbError('SQLite недоступна: ' . $e->getMessage()));
            $p = db_mysql(); $GLOBALS['SQLITE'] = false;
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
    $j = json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); if (strlen($j) > 6000000) fail(413, 'Слишком большой объём данных (уменьшите картинки)');
    q('REPLACE INTO coll (c,id,pos,data) VALUES (?,?,?,?)', [$c, $id, $pos, $j]);
}
function cdel($c, $id) { q('DELETE FROM coll WHERE c=? AND id=?', [$c, $id]); }

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
        global $CFG;
        q('INSERT INTO users (id,username,nickname,pass,data) VALUES (?,?,?,?,?)', [uid('u_'), $CFG['dev_username'], $CFG['dev_nickname'], password_hash($CFG['dev_password'], PASSWORD_DEFAULT), json_encode(['fullName' => 'Супер-Разработчик', 'role' => 'dev', 'status' => 'active', 'groups' => ['core'], 'createdAt' => iso()], JSON_UNESCAPED_UNICODE)]);
    }
}
function migrate() {
    $dev = cget('roles', 'dev');
    if (!$dev) cput('roles', 'dev', ['id' => 'dev', 'name' => 'Разработчик', 'icon' => '🛠️', 'priority' => 100, 'color' => '26 51% 57%', 'system' => true, 'permissions' => ALLP]);
    elseif (($dev['permissions'] ?? []) !== ALLP) { $dev['permissions'] = ALLP; cput('roles', 'dev', $dev); }
    $add = [
        ['id' => 'leaderboard', 'title' => 'Рейтинг', 'icon' => 'Trophy', 'order' => 4.5, 'visible' => true, 'roles' => [], 'builtin' => true, 'description' => 'Кто прошёл больше всего тестов'],
        ['id' => 'chat', 'title' => 'Чат', 'icon' => 'MessageCircle', 'order' => 4.7, 'visible' => true, 'roles' => [], 'builtin' => true, 'description' => 'Общение участников'],
        ['id' => 'calls', 'title' => 'База обзвонов', 'icon' => 'Phone', 'order' => 4.8, 'visible' => true, 'roles' => ['dev'], 'builtin' => true, 'description' => 'ID прохождений, кандидаты и баллы'],
    ];
    if (!cget('meta', 'v4_sections')) {
        cput('meta', 'v4_sections', ['done' => 1], 0);
        foreach ($add as $s) if (!cget('sections', $s['id'])) cput('sections', $s['id'], $s);
    }
}
function settings() { return (cget('settings', 'main') ?: []) + ['siteName' => 'TESTPAD STUDIO', 'siteIcon' => '◐', 'maintenance' => false, 'requireApproval' => false, 'registrationOpen' => true, 'announcement' => '', 'announcementType' => 'info', 'maintenanceText' => '']; }
function saveSettings($patch) { $s = settings(); foreach ($patch as $k => $v) $s[$k] = $v; cput('settings', 'main', $s, 0); }

// ---------- ПОЛЬЗОВАТЕЛИ (формат 3.7 + новые поля профиля) ----------
const UFIELDS = ['fullName' => '', 'role' => 'student', 'status' => 'active', 'groups' => [], 'createdAt' => '', 'avatar' => '', 'banner' => '', 'bio' => '', 'tags' => [], 'extraRoles' => [], 'lastSeen' => null];
function pub($r) { $d = json_decode($r['data'], true) ?: []; $u = ['id' => $r['id'], 'username' => $r['username'], 'nickname' => $r['nickname']]; foreach (UFIELDS as $k => $def) $u[$k] = $d[$k] ?? $def; return $u; }
function udata($u) { $o = []; foreach (UFIELDS as $k => $def) $o[$k] = $u[$k] ?? $def; return json_encode($o, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }
function saveUser($id, $u, $pass = null) {
    if ($pass !== null) q('UPDATE users SET nickname=?, pass=?, data=? WHERE id=?', [$u['nickname'], $pass, udata($u), $id]);
    else q('UPDATE users SET nickname=?, data=? WHERE id=?', [$u['nickname'], udata($u), $id]);
}
function urow($id) { $r = q('SELECT * FROM users WHERE id=?', [$id])->fetch(); return $r ?: null; }
function body() { static $b; if ($b === null) $b = json_decode(file_get_contents('php://input') ?: '', true) ?: []; return $b; }
function tok() { return $_SERVER['HTTP_X_AUTH_TOKEN'] ?? ($_SERVER['HTTP_X_TOKEN'] ?? ''); }
function me() {
    static $m = false; if ($m !== false) return $m; $m = null; $t = tok(); if (!$t) return null;
    $r = q('SELECT u.* FROM sessions s JOIN users u ON u.id=s.uid WHERE s.th=? AND s.ts>?', [hash('sha256', $t), ms() - 2592000000])->fetch();
    if ($r) { $u = pub($r); if ($u['status'] === 'active') $m = $u; }
    return $m;
}
function perms($u) {
    if (!$u) return []; if (($u['role'] ?? '') === 'dev') return ALLP;
    $P = []; foreach (array_merge([$u['role']], (array)($u['extraRoles'] ?? [])) as $rid) { $r = cget('roles', $rid); if ($r) $P = array_merge($P, (array)($r['permissions'] ?? [])); }
    return array_values(array_unique($P));
}
function can($p) { return in_array($p, perms(me()), true); }
function isStaff() { return can('users.manage'); }
function needMe() { $u = me(); if (!$u) fail(401, 'Сессия истекла'); return $u; }
function addlog($name, $role, $action, $cat) {
    $id = uid('l'); cput('logs', $id, ['id' => $id, 'time' => iso(), 'user' => $name, 'role' => $role, 'action' => str($action), 'category' => $cat], -ms());
    if (mt_rand(1, 20) === 1) q("DELETE FROM coll WHERE c='logs' AND pos > (SELECT m FROM (SELECT MAX(pos) m FROM (SELECT pos FROM coll WHERE c='logs' ORDER BY pos ASC LIMIT 1000) a) b)");
}
function touchMe($u) { $r = urow($u['id']); if (!$r) return; $x = pub($r); if (!$x['lastSeen'] || strtotime($x['lastSeen']) < time() - 8) { $x['lastSeen'] = iso(); saveUser($x['id'], $x); } }
function publicSettings() { $s = settings(); return ['registrationOpen' => $s['registrationOpen'] !== false, 'requireApproval' => !empty($s['requireApproval']), 'maintenance' => !empty($s['maintenance']), 'maintenanceText' => (string)($s['maintenanceText'] ?? ''), 'announcement' => (string)($s['announcement'] ?? ''), 'announcementType' => (string)($s['announcementType'] ?? 'info')]; }
function newSession($id) { $t = bin2hex(random_bytes(32)); q('INSERT INTO sessions (th,uid,ts) VALUES (?,?,?)', [hash('sha256', $t), $id, ms()]); return $t; }
function devCount() { $n = 0; foreach (q('SELECT * FROM users')->fetchAll() as $r) if (pub($r)['role'] === 'dev') $n++; return $n; }

function auth() {
    $b = body(); $act = (string)($b['action'] ?? 'me'); $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if ($act === 'logout') { if (tok()) q('DELETE FROM sessions WHERE th=?', [hash('sha256', tok())]); out(200, ['ok' => true]); }
    if ($act === 'register') {
        $s = publicSettings(); if (!$s['registrationOpen']) fail(403, 'Регистрация закрыта администратором');
        $un = str($b['username'] ?? '', 32); $nick = str($b['nickname'] ?? '', 32) ?: $un; $pw = (string)($b['password'] ?? '');
        if (!preg_match('/^[A-Za-z0-9_]{3,32}$/', $un)) fail(400, 'Логин: 3–32 символа, латиница, цифры и _');
        if (mb_strlen($nick) < 3) fail(400, 'Ник — от 3 символов'); if (mb_strlen($pw) < 6) fail(400, 'Пароль — от 6 символов');
        if (q('SELECT 1 FROM users WHERE LOWER(username)=LOWER(?) OR LOWER(nickname)=LOWER(?)', [$un, $nick])->fetch()) fail(409, 'Логин или ник уже занят');
        $st = $s['requireApproval'] ? 'pending' : 'active'; $id = uid('u_');
        $u = ['nickname' => $nick, 'fullName' => str($b['fullName'] ?? '', 100), 'role' => 'student', 'status' => $st, 'groups' => [], 'createdAt' => iso()];
        q('INSERT INTO users (id,username,nickname,pass,data) VALUES (?,?,?,?,?)', [$id, $un, $nick, password_hash($pw, PASSWORD_DEFAULT), udata($u)]);
        addlog($nick, 'student', $st === 'pending' ? 'Подал заявку на регистрацию' : 'Зарегистрировался', 'auth');
        if ($st === 'pending') fail(403, 'Заявка отправлена. Дождитесь одобрения администратором.');
        out(200, ['user' => pub(urow($id)), 'token' => newSession($id)]);
    }
    if ($act === 'login') {
        $r = q('SELECT * FROM rate WHERE ip=?', [$ip])->fetch(); if ($r && $r['until_ms'] > ms()) fail(429, 'Слишком много попыток. Подождите 15 минут.');
        $lg = str($b['username'] ?? '', 64);
        $row = q('SELECT * FROM users WHERE LOWER(username)=LOWER(?) OR LOWER(nickname)=LOWER(?)', [$lg, $lg])->fetch();
        if (!$row || !password_verify((string)($b['password'] ?? ''), $row['pass'])) {
            $n = ($r ? (int)$r['n'] : 0) + 1; q('REPLACE INTO rate (ip,n,until_ms) VALUES (?,?,?)', [$ip, $n >= 8 ? 0 : $n, $n >= 8 ? ms() + 900000 : 0]);
            addlog('Гость', 'guest', "Неудачная попытка входа ($lg)", 'auth'); fail(401, 'Неверный логин или пароль');
        }
        $u = pub($row); if ($u['status'] === 'pending') fail(403, 'Заявка ещё не одобрена администратором'); if ($u['status'] === 'banned') fail(403, 'Аккаунт заблокирован');
        q('DELETE FROM rate WHERE ip=?', [$ip]); q('DELETE FROM sessions WHERE ts<?', [ms() - 2592000000]);
        addlog($u['nickname'], $u['role'], 'Вошёл в систему', 'auth');
        out(200, ['user' => $u, 'token' => newSession($u['id'])]);
    }

    $me = needMe(); touchMe($me); $staff = isStaff();
    if ($act === 'me') out(200, ['user' => pub(urow($me['id'])), 'settings' => publicSettings()]);
    if ($act === 'users') {
        $list = [];
        foreach (q('SELECT * FROM users')->fetchAll() as $r) { $x = pub($r); if (!$staff && $x['status'] !== 'active') continue; if (!$staff && $x['id'] !== $me['id']) $x['username'] = ''; $list[] = $x; }
        usort($list, fn($a, $b) => strcmp((string)$a['createdAt'], (string)$b['createdAt']));
        out(200, ['users' => $list, 'settings' => publicSettings()]);
    }
    if ($act === 'profile') {
        $x = pub(urow($me['id']));
        if (array_key_exists('nickname', $b)) {
            $nick = str($b['nickname'], 32); if (mb_strlen($nick) < 3) fail(400, 'Ник — от 3 символов');
            if (q('SELECT 1 FROM users WHERE LOWER(nickname)=LOWER(?) AND id<>?', [$nick, $me['id']])->fetch()) fail(409, 'Ник уже занят');
            $x['nickname'] = $nick;
        }
        foreach (['fullName' => 100, 'bio' => 1000] as $k => $lim) if (array_key_exists($k, $b)) $x[$k] = str($b[$k], $lim);
        foreach (['avatar' => 400000, 'banner' => 900000] as $k => $lim) if (array_key_exists($k, $b)) { $v = (string)$b[$k]; if ($v !== '' && !preg_match('#^(data:image/(png|jpe?g|webp|gif);base64,|https?://)#i', $v)) fail(400, 'Неверная картинка'); if (strlen($v) > $lim) fail(413, 'Картинка слишком большая'); $x[$k] = $v; }
        if (array_key_exists('tags', $b)) $x['tags'] = array_slice(array_values(array_filter(array_map(fn($t) => str($t, 30), (array)$b['tags']))), 0, 10);
        saveUser($me['id'], $x); out(200, ['user' => $x]);
    }
    if ($act === 'online') {
        $o = []; foreach (q('SELECT * FROM users')->fetchAll() as $r) { $x = pub($r); if (!$x['lastSeen']) continue; $ago = time() - strtotime($x['lastSeen']); if ($ago <= 40) $o[] = ['id' => $x['id'], 'nickname' => $x['nickname'], 'role' => $x['role'], 'ago' => $ago]; }
        usort($o, fn($a, $b) => $a['ago'] <=> $b['ago']); out(200, ['online' => $o]);
    }

    if (!$staff) fail(403, 'Недостаточно прав');
    $isDev = $me['role'] === 'dev';
    $tid = str($b['id'] ?? '', 40); $trow = $tid !== '' ? urow($tid) : null; $t = $trow ? pub($trow) : null;
    if (in_array($act, ['update', 'kick', 'setpass', 'delete'], true) && !$t) fail(404, 'Пользователь не найден');
    if ($t && $t['role'] === 'dev' && !$isDev && $t['id'] !== $me['id']) fail(403, 'Аккаунт разработчика меняет только разработчик');

    if ($act === 'settings') {
        $p = [];
        foreach (['registrationOpen', 'requireApproval', 'maintenance'] as $k) if (array_key_exists($k, $b)) $p[$k] = !empty($b[$k]);
        if (array_key_exists('maintenanceText', $b)) $p['maintenanceText'] = str($b['maintenanceText'], 300);
        if (array_key_exists('announcement', $b)) $p['announcement'] = str($b['announcement'], 500);
        if (array_key_exists('announcementType', $b)) $p['announcementType'] = in_array($b['announcementType'], ['info', 'ok', 'warn'], true) ? $b['announcementType'] : 'info';
        if ((isset($p['maintenance']) || isset($p['announcement'])) && !can('site.manage')) fail(403, 'Нет права менять настройки сайта');
        saveSettings($p); addlog($me['nickname'], $me['role'], 'Изменил режимы сайта', 'site'); out(200, ['settings' => publicSettings()]);
    }
    if ($act === 'create') {
        $un = str($b['username'] ?? '', 32); $nick = str($b['nickname'] ?? '', 32) ?: $un; $pw = (string)($b['password'] ?? ''); $role = str($b['role'] ?? 'student', 48);
        if (!preg_match('/^[A-Za-z0-9_]{3,32}$/', $un) || mb_strlen($nick) < 3 || mb_strlen($pw) < 6) fail(400, 'Логин 3–32 (латиница, цифры, _), ник от 3, пароль от 6 символов');
        if ($role === 'dev' && !$isDev) fail(403, 'Роль разработчика выдаёт только разработчик'); if ($role !== 'dev' && !cget('roles', $role)) fail(400, 'Такой роли нет');
        if (q('SELECT 1 FROM users WHERE LOWER(username)=LOWER(?) OR LOWER(nickname)=LOWER(?)', [$un, $nick])->fetch()) fail(409, 'Логин или ник уже занят');
        $id = uid('u_'); q('INSERT INTO users (id,username,nickname,pass,data) VALUES (?,?,?,?,?)', [$id, $un, $nick, password_hash($pw, PASSWORD_DEFAULT), udata(['fullName' => str($b['fullName'] ?? '', 100), 'role' => $role, 'status' => 'active', 'groups' => [], 'createdAt' => iso()])]);
        addlog($me['nickname'], $me['role'], "Создал аккаунт @$un", 'users'); out(200, ['user' => pub(urow($id))]);
    }
    if ($act === 'update') {
        $x = $t;
        if (array_key_exists('role', $b)) {
            $role = str($b['role'], 48); if ($role !== 'dev' && !cget('roles', $role)) fail(400, 'Роль не найдена');
            if (($role === 'dev' || $t['role'] === 'dev') && !$isDev) fail(403, 'Роль разработчика меняет только разработчик');
            if ($t['id'] === $me['id'] && $role !== $t['role']) fail(400, 'Нельзя менять роль себе');
            if ($t['role'] === 'dev' && $role !== 'dev' && devCount() <= 1) fail(400, 'Нельзя снять последнего разработчика');
            $x['role'] = $role;
        }
        if (array_key_exists('status', $b)) {
            if (!in_array($b['status'], ['active', 'banned', 'pending'], true)) fail(400, 'Неверный статус'); if ($t['id'] === $me['id']) fail(400, 'Нельзя заблокировать себя');
            $x['status'] = $b['status']; if ($b['status'] !== 'active') q('DELETE FROM sessions WHERE uid=?', [$t['id']]);
        }
        if (array_key_exists('extraRoles', $b)) $x['extraRoles'] = array_slice(array_values(array_unique(array_filter(array_map(fn($v) => str($v, 48), (array)$b['extraRoles']), fn($v) => $v !== '' && ($v !== 'dev' || $isDev)))), 0, 20);
        if (array_key_exists('groups', $b)) $x['groups'] = array_slice(array_values(array_unique(array_filter(array_map(fn($v) => str($v, 48), (array)$b['groups'])))), 0, 30);
        if (array_key_exists('tags', $b)) $x['tags'] = array_slice(array_values(array_filter(array_map(fn($v) => str($v, 30), (array)$b['tags']))), 0, 10);
        if (array_key_exists('fullName', $b)) $x['fullName'] = str($b['fullName'], 100);
        if (array_key_exists('nickname', $b)) { $nick = str($b['nickname'], 32); if (mb_strlen($nick) < 3) fail(400, 'Ник — от 3 символов'); if (q('SELECT 1 FROM users WHERE LOWER(nickname)=LOWER(?) AND id<>?', [$nick, $t['id']])->fetch()) fail(409, 'Ник уже занят'); $x['nickname'] = $nick; }
        saveUser($t['id'], $x); addlog($me['nickname'], $me['role'], "Изменил пользователя @{$t['username']}", 'users'); out(200, ['user' => $x]);
    }
    if ($act === 'setpass') {
        $pw = (string)($b['password'] ?? ''); if (mb_strlen($pw) < 6) fail(400, 'Пароль — от 6 символов');
        saveUser($t['id'], $t, password_hash($pw, PASSWORD_DEFAULT));
        q('DELETE FROM sessions WHERE uid=? AND th<>?', [$t['id'], hash('sha256', tok())]);
        addlog($me['nickname'], $me['role'], "Сменил пароль @{$t['username']}", 'users'); out(200, ['ok' => true]);
    }
    if ($act === 'kick') { if ($t['id'] === $me['id']) fail(400, 'Нельзя выкинуть себя'); q('DELETE FROM sessions WHERE uid=?', [$t['id']]); $t['lastSeen'] = null; saveUser($t['id'], $t); out(200, ['ok' => true]); }
    if ($act === 'kickall') { $n = q('DELETE FROM sessions WHERE uid<>?', [$me['id']])->rowCount(); addlog($me['nickname'], $me['role'], 'Завершил сессии всех', 'system'); out(200, ['ok' => true, 'n' => $n]); }
    if ($act === 'delete') {
        if ($t['id'] === $me['id']) fail(400, 'Нельзя удалить себя'); if ($t['role'] === 'dev' && devCount() <= 1) fail(400, 'Нельзя удалить последнего разработчика');
        q('DELETE FROM users WHERE id=?', [$t['id']]); q('DELETE FROM sessions WHERE uid=?', [$t['id']]); out(200, ['ok' => true]);
    }
    if ($act === 'unlock') { q('DELETE FROM rate'); out(200, ['ok' => true]); }
    fail(400, 'Неизвестное действие');
}

// ---------- ДАННЫЕ САЙТА: отдаём только то, что разрешено ----------
function state() {
    $u = me(); $s = settings(); $has = fn($p) => can($p);
    $site = []; foreach (SITE_KEYS as $k) if (array_key_exists($k, $s)) $site[$k] = $s[$k];
    $db = ['settings' => $site, 'roles' => cl('roles'), 'sections' => cl('sections'), 'questions' => [], 'tests' => [], 'groups' => [], 'news' => [], 'faq' => [], 'results' => [], 'tickets' => [], 'posts' => [], 'logs' => []];
    if ($u && (empty($s['maintenance']) || $has('site.manage'))) {
        $db['tests'] = cl('tests');
        $qs = cl('questions');
        if (!$has('questions.manage')) { $ids = []; foreach ($db['tests'] as $t) foreach (($t['questionIds'] ?? []) as $i) $ids[$i] = 1; $qs = array_values(array_filter($qs, fn($x) => isset($ids[$x['id']]))); }
        $db['questions'] = $qs;
        $db['groups'] = cl('groups'); $db['news'] = cl('news'); $db['faq'] = cl('faq'); $db['posts'] = cl('posts');
        $db['results'] = cl('results');
        $db['tickets'] = array_values(array_filter(cl('tickets'), fn($t) => $has('tickets.manage') || ($t['userId'] ?? '') === $u['id']));
        if ($has('logs.view')) $db['logs'] = cl('logs');
    }
    out(200, ['db' => $db]);
}

// ---------- ЗАПИСЬ ИЗМЕНЕНИЙ с проверкой прав ----------
function save() {
    $me = needMe(); $s = settings(); if (!empty($s['maintenance']) && !can('site.manage')) fail(503, 'Технические работы на сайте');
    $ch = (array)(body()['changes'] ?? []); db()->beginTransaction();
    foreach ($ch as $c => $d) {
        $up = (array)($d['up'] ?? []); $del = (array)($d['del'] ?? []);
        if ($c === 'settings') {
            if (!$up) continue; if (!can('site.manage')) fail(403, 'Нет права менять сайт');
            $x = (array)$up[0]; $p = [];
            foreach (['siteName' => 60, 'siteIcon' => 300000, 'bannerDim' => 200, 'bannerTitle' => 400, 'bannerSubtitle' => 400, 'bannerImage' => 1500000, 'footerText' => 200] as $k => $lim) if (array_key_exists($k, $x)) $p[$k] = mb_substr((string)$x[$k], 0, $lim);
            if (isset($x['footerLinks'])) $p['footerLinks'] = array_slice(array_map(fn($l) => ['label' => str($l['label'] ?? '', 40), 'title' => str($l['title'] ?? '', 60), 'icon' => str($l['icon'] ?? '', 40), 'url' => str($l['url'] ?? '', 400)], (array)$x['footerLinks']), 0, 8);
            saveSettings($p); continue;
        }
        if ($c === 'logs') {
            foreach ($up as $x) { if (cget('logs', str($x['id'] ?? '', 48))) continue; $cat = in_array($x['category'] ?? '', ['auth','tests','content','users','sections','site','support','system'], true) ? $x['category'] : 'system'; addlog($me['nickname'], $me['role'], $x['action'] ?? '', $cat); }
            if ($del) { if (!can('logs.view')) fail(403, 'Нет права очищать журнал'); foreach ($del as $id) cdel('logs', str($id, 48)); }
            continue;
        }
        if ($c === 'results') {
            foreach ($up as $x) {
                $id = str($x['id'] ?? '', 48); if ($id === '' || cget('results', $id)) continue;
                if (!can('tests.take')) fail(403, 'Нет права проходить тесты');
                $t = cget('tests', str($x['testId'] ?? '', 48)); if (!$t) fail(400, 'Тест не найден');
                if (!empty($t['isBlocked'])) fail(403, 'Тест заблокирован');
                $myRoles = array_merge([$me['role']], (array)($me['extraRoles'] ?? []));
                if (!empty($t['roles']) && $me['role'] !== 'dev' && !array_intersect($t['roles'], $myRoles)) fail(403, 'Тест недоступен вашей роли');
                if (!empty($t['groupCode']) && !in_array($t['groupCode'], (array)$me['groups'], true) && !can('tests.manage')) fail(403, 'Нет доступа к тесту');
                $max = (int)($t['maxAttempts'] ?? 0); if ($max > 0 && count(array_filter(cl('results'), fn($r) => ($r['userId'] ?? '') === $me['id'] && ($r['testId'] ?? '') === $t['id'])) >= $max) fail(403, 'Лимит попыток исчерпан');
                $cn = cget('meta', 'counters') ?: []; $num = (int)($cn['result'] ?? 0) + 1; $cn['result'] = $num; cput('meta', 'counters', $cn, 0);
                $form = []; foreach ((array)($x['form'] ?? []) as $z) if (is_array($z)) $form[] = ['id' => str($z['id'] ?? '', 48), 'label' => str($z['label'] ?? '', 120), 'value' => str($z['value'] ?? '', 300)];
                $score = max(0, min(100, (int)($x['score'] ?? 0)));
                cput('results', $id, ['id' => $id, 'userId' => $me['id'], 'testId' => $t['id'], 'nickname' => $me['nickname'], 'score' => $score, 'passed' => $score >= (int)($t['passScore'] ?? 0), 'date' => iso(), 'form' => $form, 'correct' => (int)($x['correct'] ?? 0), 'total' => (int)($x['total'] ?? 0), 'num' => $num, 'code' => 'T-' . str_pad((string)$num, 5, '0', STR_PAD_LEFT), 'testTitle' => str($t['title'] ?? '', 200)], -ms());
            }
            if ($del) { if (!can('results.viewAll')) fail(403, 'Нет права удалять результаты'); foreach ($del as $id) cdel('results', str($id, 48)); }
            continue;
        }
        if ($c === 'tickets') {
            foreach ($up as $x) {
                $id = str($x['id'] ?? '', 48); if ($id === '') continue; $old = cget('tickets', $id);
                if ($old && ($old['userId'] ?? '') !== $me['id'] && !can('tickets.manage')) fail(403, 'Чужое обращение');
                $x['userId'] = $old ? $old['userId'] : $me['id']; $x['subject'] = str($x['subject'] ?? '', 200);
                if (!can('tickets.manage') && $old) $x['status'] = $old['status'] ?? 'open';
                $x['messages'] = array_slice(array_map(fn($m) => ['id' => str($m['id'] ?? uid('m'), 48), 'from' => str($m['from'] ?? '', 40), 'name' => str($m['name'] ?? '', 60), 'role' => str($m['role'] ?? '', 48), 'text' => str($m['text'] ?? '', 4000), 'date' => str($m['date'] ?? iso(), 40), 'images' => array_slice(array_filter((array)($m['images'] ?? []), 'is_string'), 0, 6)], (array)($x['messages'] ?? [])), 0, 200);
                cput('tickets', $id, $x, $old ? null : -ms());
            }
            if ($del) { if (!can('tickets.manage')) fail(403, 'Нет права удалять обращения'); foreach ($del as $id) cdel('tickets', str($id, 48)); }
            continue;
        }
        if ($c === 'posts') {
            foreach ($up as $x) {
                $id = str($x['id'] ?? '', 48); if ($id === '') continue; $old = cget('posts', $id);
                $sec = cget('sections', str($x['sectionId'] ?? '', 48)); if (!$sec) fail(400, 'Раздел не найден');
                $myRoles = array_merge([$me['role']], (array)($me['extraRoles'] ?? []));
                $allowed = can('sections.manage') || array_intersect((array)($sec['postRoles'] ?? []), $myRoles);
                if ($old && ($old['userId'] ?? '') !== $me['id'] && !can('sections.manage')) fail(403, 'Чужой пост');
                if (!$old && !$allowed) fail(403, 'Нет права публиковать в этом разделе');
                cput('posts', $id, ['id' => $id, 'sectionId' => $sec['id'], 'userId' => $old['userId'] ?? $me['id'], 'text' => str($x['text'] ?? '', 4000), 'images' => array_slice(array_filter((array)($x['images'] ?? []), 'is_string'), 0, 6), 'date' => $old['date'] ?? iso()], $old ? null : -ms());
            }
            foreach ($del as $id) { $o = cget('posts', str($id, 48)); if ($o && ($o['userId'] ?? '') !== $me['id'] && !can('sections.manage')) fail(403, 'Чужой пост'); cdel('posts', str($id, 48)); }
            continue;
        }
        $perm = MANAGE[$c] ?? null; if (!$perm) continue; if (!can($perm)) fail(403, 'Недостаточно прав: ' . $perm);
        foreach ($up as $x) {
            $id = str($x['id'] ?? '', 48); if ($id === '') continue; $x['id'] = $id;
            if ($c === 'roles') { $x['permissions'] = $id === 'dev' ? ALLP : array_values(array_intersect(ALLP, (array)($x['permissions'] ?? []))); if ($id === 'dev') $x['system'] = true; }
            cput($c, $id, $x);
        }
        foreach ($del as $id) {
            $id = str($id, 48); $o = cget($c, $id);
            if ($c === 'roles' && $o && !empty($o['system'])) fail(400, 'Системную роль удалить нельзя');
            if ($c === 'sections' && $id === 'dev') fail(400, 'Админ-панель удалить нельзя');
            cdel($c, $id);
        }
    }
    db()->commit(); out(200, ['ok' => true]);
}

// ---------- ЧАТ с тегами @ник ----------
function chat() {
    $me = needMe(); touchMe($me);
    if (!empty(settings()['maintenance']) && !can('site.manage')) fail(503, 'Технические работы на сайте');
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $b = body();
        if (($b['action'] ?? '') === 'delete') {
            $m = cget('chat', str($b['id'] ?? '', 48)); if (!$m) fail(404, 'Сообщение не найдено');
            if (($m['userId'] ?? '') !== $me['id'] && !can('users.manage')) fail(403, 'Можно удалять только свои сообщения');
            cdel('chat', $m['id']); out(200, ['ok' => true]);
        }
        $t = trim((string)preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', (string)($b['text'] ?? ''))); if ($t === '') fail(400, 'Пустое сообщение'); $t = mb_substr($t, 0, 1000);
        $last = q("SELECT data FROM coll WHERE c='chat' ORDER BY pos DESC LIMIT 20")->fetchAll();
        foreach ($last as $r) { $m = json_decode($r['data'], true); if (($m['userId'] ?? '') === $me['id'] && ms() - (int)($m['ts'] ?? 0) < 1200) fail(429, 'Слишком часто'); }
        $all = can('users.manage') && preg_match('/(^|\s)@(all|everyone|все|всем)(?![\p{L}\p{N}_])/iu', $t); $men = [];
        foreach (q('SELECT * FROM users')->fetchAll() as $ur) { $x = pub($ur); if ($x['status'] !== 'active' || $x['id'] === $me['id']) continue; if ($all || preg_match('/(^|[^\p{L}\p{N}_])@' . preg_quote($x['nickname'], '/') . '(?![\p{L}\p{N}_])/iu', $t)) $men[] = $x['id']; }
        $seq = (int)(microtime(true) * 1000); $id = uid('c_');
        cput('chat', $id, ['id' => $id, 'seq' => $seq, 'userId' => $me['id'], 'nickname' => $me['nickname'], 'role' => $me['role'], 'text' => $t, 'date' => iso(), 'ts' => ms(), 'mentions' => array_slice($men, 0, 300)], $seq);
        if (mt_rand(1, 30) === 1) q("DELETE FROM coll WHERE c='chat' AND pos < (SELECT p FROM (SELECT pos p FROM coll WHERE c='chat' ORDER BY pos DESC LIMIT 1 OFFSET 499) t)");
        out(200, ['ok' => true]);
    }
    $since = (int)($_GET['since'] ?? 0);
    $rows = q("SELECT data, pos FROM coll WHERE c='chat' AND pos > ? ORDER BY pos DESC LIMIT 100", [$since])->fetchAll();
    $msgs = []; foreach (array_reverse($rows) as $r) { $m = json_decode($r['data'], true); $m['seq'] = (int)$r['pos']; $m['role'] = $m['role'] ?? 'student'; $m['mentions'] = $m['mentions'] ?? []; $msgs[] = $m; }
    $users = []; foreach (q('SELECT * FROM users')->fetchAll() as $r) { $x = pub($r); if ($x['status'] === 'active') $users[] = ['id' => $x['id'], 'nickname' => $x['nickname'], 'role' => $x['role']]; }
    out(200, ['messages' => $msgs, 'users' => $users, 'me' => $me['id']]);
}

// ---------- РЕЗЕРВНЫЕ КОПИИ ----------
function backupRoute() {
    $me = needMe(); if (!can('backup.manage')) fail(403, 'Нет права на резервные копии');
    addlog($me['nickname'], $me['role'], 'Скачал резервную копию с сервера', 'system');
    out(200, ['format' => 'testpad-backup-v1', 'created' => iso(), 'users' => q('SELECT id,username,nickname,pass,data FROM users')->fetchAll(), 'coll' => q("SELECT c,id,pos,data FROM coll")->fetchAll()]);
}

install(); migrate();
switch ($_GET['r'] ?? '') {
    case 'auth': if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST'); auth(); break;
    case 'state': state(); break;
    case 'save': case 'sync': if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST'); save(); break;
    case 'chat': chat(); break;
    case 'backup': backupRoute(); break;
    default: fail(404, 'Метод не найден');
}
