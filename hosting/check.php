<?php
// Диагностика TESTPAD. Откройте https://ваш-сайт/check.php и пришлите результат. После настройки УДАЛИТЕ этот файл.
header('Content-Type: text/html; charset=utf-8');
ini_set('display_errors', '1'); error_reporting(E_ALL);
function row($ok, $t, $d = '') { echo '<p style="font:16px/1.5 sans-serif;margin:6px 0">' . ($ok ? '✅' : '❌') . ' <b>' . htmlspecialchars($t) . '</b> ' . htmlspecialchars($d) . '</p>'; }
echo '<h2 style="font-family:sans-serif">Проверка TESTPAD</h2>';
row(version_compare(PHP_VERSION, '7.4', '>='), 'Версия PHP', PHP_VERSION . ' (нужна 7.4+)');
foreach (['pdo', 'mbstring', 'json'] as $e) row(extension_loaded($e), "Расширение $e", extension_loaded($e) ? 'есть' : 'ОТСУТСТВУЕТ — включите в панели хостинга (выбор версии PHP / расширения)');
foreach (['openssl', 'curl'] as $e) row(extension_loaded($e), "Расширение $e (для push-уведомлений на закрытом сайте)", extension_loaded($e) ? 'есть' : 'нет — push на закрытом сайте не заработает, остальное (теги, звонки, уведомления на открытом сайте) работает');
row(is_file(__DIR__ . '/api.php'), 'Файл api.php', 'в папке ' . __DIR__);
row(is_file(__DIR__ . '/seed.json'), 'Файл seed.json');
$cfg = null;
if (!is_file(__DIR__ . '/config.php')) row(false, 'Файл config.php', 'НЕ НАЙДЕН в ' . __DIR__ . ' — загрузите его из архива рядом с api.php');
else try { $cfg = require __DIR__ . '/config.php'; row(is_array($cfg), 'config.php читается', 'база: ' . ($cfg['name'] ?? '?') . ', пользователь: ' . ($cfg['user'] ?? '?') . ', хост: ' . ($cfg['host'] ?? '?')); }
catch (Throwable $e) { row(false, 'config.php', $e->getMessage()); }
if (is_array($cfg) && ($cfg['driver'] ?? 'auto') === 'sqlite' || (($cfg['driver'] ?? 'auto') === 'auto' && extension_loaded('pdo_sqlite'))) {
    row(extension_loaded('pdo_sqlite'), 'Расширение pdo_sqlite', extension_loaded('pdo_sqlite') ? 'есть' : 'ОТСУТСТВУЕТ — включите в панели хостинга или поставьте driver => mysql в config.php');
    $dd = __DIR__ . '/data'; if (!is_dir($dd)) @mkdir($dd, 0755, true);
    row(is_dir($dd) && is_writable($dd), 'Папка data (для базы)', is_writable($dd) ? 'доступна для записи' : 'НЕТ ПРАВ — создайте папку data и поставьте права 755 или 777');
} elseif (is_array($cfg) && extension_loaded('pdo_mysql')) {
    $opt = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION];
    $okHost = null;
    foreach (array_unique([$cfg['host'], 'localhost', '127.0.0.1']) as $h) {
        try { new PDO("mysql:host=$h;charset=utf8mb4", $cfg['user'], $cfg['pass'], $opt); row(true, "Вход в MySQL (хост $h)", 'логин и пароль верные'); $okHost = $h; break; }
        catch (Throwable $e) { row(false, "Вход в MySQL (хост $h)", $e->getMessage()); }
    }
    if ($okHost) {
        $pdo = new PDO("mysql:host=$okHost;charset=utf8mb4", $cfg['user'], $cfg['pass'], $opt);
        try { $dbs = $pdo->query('SHOW DATABASES')->fetchAll(PDO::FETCH_COLUMN); $dbs = array_diff($dbs, ['information_schema', 'performance_schema', 'mysql', 'sys']);
            row(true, 'Базы, доступные этому пользователю', $dbs ? implode(', ', $dbs) : '— нет ни одной: создайте базу и привяжите к пользователю в панели'); } catch (Throwable $e) { row(false, 'Список баз', $e->getMessage()); }
        try { new PDO("mysql:host=$okHost;dbname={$cfg['name']};charset=utf8mb4", $cfg['user'], $cfg['pass'], $opt); row(true, "База «{$cfg['name']}»", 'подключение успешно — сайт должен работать'); }
        catch (Throwable $e) { row(false, "База «{$cfg['name']}»", $e->getMessage() . ' → впишите в config.php (поле name) имя из списка выше'); }
        if ($okHost !== $cfg['host']) row(false, 'Совет', "в config.php поставьте 'host' => '$okHost'");
    }
}
$d = __DIR__ . '/backups'; row(is_writable(__DIR__), 'Запись в папку сайта', is_writable(__DIR__) ? 'есть' : 'нет (нужна только для резервных копий)');
echo '<p style="font:14px sans-serif;color:#888">После проверки удалите check.php</p>';
