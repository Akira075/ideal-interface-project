<?php
// Настройки TESTPAD STUDIO. По умолчанию — SQLite: ничего настраивать не нужно,
// база создаётся сама в папке data/ (не удаляйте её при обновлении сайта).
return [
    'driver' => 'auto',          // 'auto' (SQLite, если нет — MySQL), 'sqlite' или 'mysql'
    // MySQL — запасной вариант: используется, если SQLite на хостинге недоступна (нет pdo_sqlite или нет прав на папку data):
    'host' => 'localhost', 'name' => 'amirchik_133', 'user' => 'amirchik_133', 'pass' => 'amirchik_133',
    'debug' => false,            // true — показывать причину ошибки сервера (на время настройки)
    // Аккаунт разработчика создаётся при первом запуске. СМЕНИТЕ пароль до загрузки на хостинг!
    'dev_username' => 'Astrovskii',
    'dev_nickname' => 'Amir_Karver',
    'dev_password' => '5nzcQiQe3ommAE',
];
