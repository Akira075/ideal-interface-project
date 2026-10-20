import { DB, LogEntry } from "./types";

export const uid = (p: string) => p + Math.random().toString(36).slice(2, 10);
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();

const A = "Администрирование";
const R = "Регламент";

export function createSeed(): DB {
  const questions = [
    { id: "q1", title: "Каковы основные обязанности младшего администратора сервера?", category: A, type: "SINGLE" as const, options: ["Ответы на репорты и помощь игрокам", "Спавн автомобилей для себя", "Выдача денег друзьям"], correct: ["Ответы на репорты и помощь игрокам"], createdAt: ago(9000) },
    { id: "q2", title: "Разрешено ли разглашать админ-информацию третьим лицам?", category: A, type: "BOOLEAN" as const, options: ["Категорически запрещено", "Разрешено друзьям"], correct: ["Категорически запрещено"], createdAt: ago(8900) },
    { id: "q3", title: "Что нужно сделать при обнаружении нарушителя? (несколько ответов)", category: A, type: "MULTIPLE" as const, options: ["Собрать доказательства", "Выдать наказание по регламенту", "Проигнорировать", "Наказать без доказательств"], correct: ["Собрать доказательства", "Выдать наказание по регламенту"], createdAt: ago(8800) },
    { id: "q4", title: "Как называется документ, по которому выдаются наказания игрокам? (одно слово)", category: R, type: "TEXT" as const, options: [], correct: ["регламент", "правила"], createdAt: ago(8700) },
    { id: "q5", title: "Администратор получил просьбу выдать деньги другу. Правильное действие?", category: R, type: "SINGLE" as const, options: ["Отказать и сообщить вышестоящему", "Выдать немного", "Выдать и никому не говорить"], correct: ["Отказать и сообщить вышестоящему"], createdAt: ago(8600) },
    { id: "q6", title: "Можно ли использовать админ-права в личных целях?", category: R, type: "BOOLEAN" as const, options: ["Нет", "Да"], correct: ["Нет"], createdAt: ago(8500) },
  ];

  const logs: LogEntry[] = [
    { id: uid("l"), time: ago(2), user: "Amir_Karver", role: "dev", action: "Изменил баннер главной страницы", category: "site" },
    { id: uid("l"), time: ago(7), user: "Marina_T", role: "teacher", action: "Создала тест «Редактор раздела»", category: "tests" },
    { id: uid("l"), time: ago(12), user: "Ivan_K", role: "student", action: "Прошёл тест «Вход и роли» — 92%", category: "tests" },
    { id: uid("l"), time: ago(18), user: "Oleg_Admin", role: "admin", action: "Ответил на обращение «Не открывается тест»", category: "support" },
    { id: uid("l"), time: ago(25), user: "Ivan_K", role: "student", action: "Вошёл в систему", category: "auth" },
    { id: uid("l"), time: ago(40), user: "Amir_Karver", role: "dev", action: "Создал раздел «База знаний и гайды»", category: "sections" },
    { id: uid("l"), time: ago(55), user: "Oleg_Admin", role: "admin", action: "Выдал роль «Учитель» пользователю @marina", category: "users" },
    { id: uid("l"), time: ago(90), user: "Система", role: "system", action: "Создана резервная копия базы", category: "system" },
    { id: uid("l"), time: ago(130), user: "Marina_T", role: "teacher", action: "Опубликовала новость «Обновление банка вопросов»", category: "content" },
    { id: uid("l"), time: ago(200), user: "Anna_S", role: "student", action: "Неудачная попытка входа", category: "auth" },
  ];

  return {
    settings: {
      siteName: "TESTPAD STUDIO",
      siteIcon: "◐",
      bannerDim: "Каждый тест",
      bannerTitle: "на своём месте.\nКаждый лог — под рукой.",
      bannerSubtitle: "Разделы, роли и UIA‑логи в одном спокойном пространстве.",
      bannerImage: "",
      maintenance: false,
      requireApproval: false,
    },
    roles: [
      { id: "dev", name: "Разработчик", icon: "🛠️", priority: 100, hoist: true, color: "26 51% 57%", system: true, permissions: ["tests.take", "tests.manage", "questions.manage", "results.viewAll", "groups.manage", "news.manage", "faq.manage", "tickets.manage", "users.manage", "roles.manage", "sections.manage", "site.manage", "logs.view", "backup.manage"] },
      { id: "admin", name: "Администратор", icon: "🛡️", priority: 80, hoist: true, color: "210 80% 62%", system: true, permissions: ["tests.take", "tests.manage", "questions.manage", "results.viewAll", "groups.manage", "news.manage", "faq.manage", "tickets.manage", "users.manage", "logs.view"] },
      { id: "teacher", name: "Учитель", icon: "🎓", priority: 50, color: "146 50% 57%", permissions: ["tests.take", "tests.manage", "questions.manage", "results.viewAll", "groups.manage", "news.manage"] },
      { id: "moderator", name: "Модератор", icon: "⚡", priority: 60, color: "280 55% 66%", permissions: ["tests.take", "faq.manage", "tickets.manage", "news.manage"] },
      { id: "student", name: "Ученик", icon: "📚", priority: 10, color: "240 2% 70%", system: true, permissions: ["tests.take"] },
    ],
    users: [
      { id: "db1", username: "Astrovskii", nickname: "Amir_Karver", fullName: "Супер-Разработчик", role: "dev", status: "active", groups: ["core"], createdAt: ago(30000) },
    ],
    sections: [
      { id: "home", title: "Обзор", icon: "LayoutGrid", order: 1, visible: true, roles: [], builtin: true, description: "Главная страница" },
      { id: "tests", title: "Все тесты", icon: "ClipboardCheck", order: 2, visible: true, roles: [], builtin: true, description: "Список доступных тестов" },
      { id: "questions", title: "Банк вопросов", icon: "Library", order: 3, visible: true, roles: ["dev", "admin", "teacher"], builtin: true, description: "Все вопросы для тестов" },
      { id: "results", title: "Результаты", icon: "BarChart3", order: 4, visible: true, roles: [], builtin: true, description: "Итоги прохождений" },
      { id: "groups", title: "Группы", icon: "Users", order: 5, visible: true, roles: [], builtin: true, description: "Учебные группы" },
      { id: "news", title: "Новости", icon: "Newspaper", order: 6, visible: true, roles: [], builtin: true, description: "Объявления платформы", subtitle: "Лента и анонсы", badge: "СКОРО" },
      { id: "faq", title: "Вопросы и ответы", icon: "MessageCircleQuestion", order: 7, visible: true, roles: [], builtin: true, description: "Частые вопросы" },
      { id: "support", title: "Обратная связь", icon: "Bug", order: 89, visible: true, roles: [], builtin: true, description: "Обращения в поддержку", subtitle: "Баги/Предложения", bottom: true },
      { id: "s_kb", title: "База знаний и гайды", icon: "BookOpen", order: 9, visible: true, roles: [], builtin: false, description: "Правила и инструкции", content: "Правила проведения обзвонов и подачи отчётов.\n\nРазработчик может править этот раздел в панели управления без кода." },
      { id: "profile", title: "Личный кабинет", icon: "CircleUser", order: 90, visible: true, roles: [], builtin: true, description: "Профиль и настройки", bottom: true },
      { id: "dev", title: "Админ-панель", icon: "Settings2", order: 91, visible: true, roles: ["dev"], builtin: true, description: "Логи, разделы, роли, настройки", bottom: true },
    ],
    questions,
    tests: [
      { id: "t1", title: "Вход и роли", category: "Авторизация · UIA", description: "Проверка знаний о ролях и правах доступа.", questionIds: ["q1", "q2", "q3"], passScore: 70, timeLimit: 10, maxAttempts: 3, groupCode: "", isBlocked: false, createdAt: ago(7000) },
      { id: "t2", title: "Главное меню", category: "Интерфейс · UIA", description: "Навигация, разделы и основные действия.", questionIds: ["q4", "q5", "q6"], passScore: 70, timeLimit: 8, maxAttempts: 0, groupCode: "", isBlocked: false, createdAt: ago(6000) },
      { id: "t3", title: "Редактор раздела", category: "Разделы", description: "Как создавать и настраивать разделы.", questionIds: ["q1", "q5", "q6"], passScore: 80, timeLimit: 5, maxAttempts: 2, groupCode: "a1", isBlocked: false, createdAt: ago(5000) },
      { id: "t4", title: "Регламент администратора", category: "Регламент", description: "Итоговая аттестация по регламенту.", questionIds: ["q2", "q3", "q4", "q5"], passScore: 75, timeLimit: 15, maxAttempts: 1, groupCode: "core", isBlocked: false, createdAt: ago(4000) },
    ],
    results: [
      ...Array.from({ length: 52 }, (_, i) => ({ id: "r1_" + i, userId: "demo", testId: "t1", nickname: i % 2 ? "Ivan_K" : "Marina_T", score: i < 48 ? 80 + (i % 20) : 40, passed: i < 48, date: ago(i * 60) })),
      ...Array.from({ length: 41 }, (_, i) => ({ id: "r2_" + i, userId: "demo", testId: "t2", nickname: "Ivan_K", score: i < 31 ? 75 + (i % 25) : 50, passed: i < 31, date: ago(i * 90) })),
      ...Array.from({ length: 24 }, (_, i) => ({ id: "r3_" + i, userId: "demo", testId: "t3", nickname: "Marina_T", score: 85 + (i % 15), passed: true, date: ago(i * 120) })),
    ],
    groups: [
      { id: "g1", code: "core", name: "Основной состав", description: "Администрация и разработчики" },
      { id: "g2", code: "a1", name: "Поток А-1", description: "Новые сотрудники, осень 2026" },
    ],
    news: [
      { id: "n1", title: "TESTPAD STUDIO V6", text: "Новый интерфейс, роли с гибкими правами, журнал действий UIA и настраиваемые разделы.", author: "Amir_Karver", date: ago(60), pinned: true },
      { id: "n2", title: "Обновление банка вопросов", text: "Добавлены вопросы по регламенту администратора. Проверьте свои тесты.", author: "Marina_T", date: ago(1500), pinned: false },
    ],
    faq: [
      { id: "f1", q: "Как пройти тест?", a: "Откройте раздел «Все тесты», выберите тест и нажмите «Начать». Результат появится сразу после завершения." },
      { id: "f2", q: "Сколько попыток у меня есть?", a: "Количество попыток задаёт автор теста. Оно указано на карточке теста." },
      { id: "f3", q: "Как попасть в группу?", a: "Попросите учителя или администратора добавить вас в группу — после этого откроются закрытые тесты." },
      { id: "f4", q: "Куда писать, если что-то сломалось?", a: "В раздел «Поддержка». Создайте обращение — разработчик ответит в течение дня." },
    ],
    tickets: [
      { id: "k1", userId: "demo", subject: "Не открывается тест", status: "open", date: ago(30), messages: [
        { id: "m1", from: "u4", name: "Ivan_K", role: "student", text: "Тест «Регламент администратора» пишет, что нет доступа.", date: ago(30) },
        { id: "m2", from: "u2", name: "Oleg_Admin", role: "admin", text: "Тест доступен только группе «Основной состав». Добавим вас после аттестации.", date: ago(18) },
      ] },
    ],
    logs,
    sessionUserId: null,
  };
}
