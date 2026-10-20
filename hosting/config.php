<?php
// Настройки TESTPAD STUDIO. По умолчанию — SQLite: ничего настраивать не нужно,
// база создаётся сама в папке data/ (не удаляйте её при обновлении сайта).
return [
    'driver' => 'auto',          // 'auto' (SQLite, если нет — MySQL), 'sqlite' или 'mysql'
    'host' => 'localhost', 'name' => '', 'user' => '', 'pass' => '',
    'debug' => false,            // true — показывать причину ошибки сервера (на время настройки)
    // Аккаунт разработчика создаётся при ПЕРВОМ запуске (если база пустая). СМЕНИТЕ пароль до загрузки!
    'dev_username' => 'Astrovskii',
    'dev_nickname' => 'Amir_Karver',
    'dev_password' => 'ChangeMe_123',
];
