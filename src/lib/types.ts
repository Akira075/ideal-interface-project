export type Permission =
  | "tests.take"
  | "tests.manage"
  | "questions.manage"
  | "results.viewAll"
  | "groups.manage"
  | "news.manage"
  | "faq.manage"
  | "tickets.manage"
  | "users.manage"
  | "roles.manage"
  | "sections.manage"
  | "site.manage"
  | "logs.view"
  | "backup.manage";

export const PERMISSIONS: { id: Permission; label: string }[] = [
  { id: "tests.take", label: "Проходить тесты" },
  { id: "tests.manage", label: "Создавать и править тесты" },
  { id: "questions.manage", label: "Банк вопросов" },
  { id: "results.viewAll", label: "Видеть все результаты" },
  { id: "groups.manage", label: "Управлять группами" },
  { id: "news.manage", label: "Публиковать новости" },
  { id: "faq.manage", label: "Вопросы и ответы" },
  { id: "tickets.manage", label: "Отвечать на обращения" },
  { id: "users.manage", label: "Управлять пользователями" },
  { id: "roles.manage", label: "Управлять ролями" },
  { id: "sections.manage", label: "Управлять разделами" },
  { id: "site.manage", label: "Иконка, баннер, настройки" },
  { id: "logs.view", label: "Журнал действий UIA" },
  { id: "backup.manage", label: "Резервные копии" },
];

export interface Role {
  id: string;
  name: string;
  color: string; // tailwind-safe hsl string
  permissions: Permission[];
  system?: boolean;
  icon?: string;
  priority?: number;
  hoist?: boolean;
}

export interface User {
  id: string;
  username: string;
  nickname: string;
  fullName: string;
  role: string;
  status: "active" | "banned" | "pending";
  groups: string[];
  createdAt: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  tags?: string[];
  extraRoles?: string[];
}

export interface Section {
  id: string;
  title: string;
  icon: string;
  order: number;
  visible: boolean;
  roles: string[]; // пусто = всем
  builtin: boolean;
  description: string;
  content?: string;
  bottom?: boolean;
  badge?: string;
  subtitle?: string;
  images?: string[];
  postRoles?: string[];
}

export type QType = "SINGLE" | "MULTIPLE" | "BOOLEAN" | "TEXT";

export interface Question {
  id: string;
  image?: string;
  title: string;
  category: string;
  type: QType;
  options: string[];
  correct: string[];
  createdAt: string;
}

export interface Test {
  id: string;
  title: string;
  category: string;
  description: string;
  questionIds: string[];
  passScore: number;
  timeLimit: number;
  maxAttempts: number;
  groupCode: string;
  isBlocked: boolean;
  createdAt: string;
  roles?: string[];
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  questionLimit?: number;
  showAnswers?: boolean;
  image?: string;
}

export interface Result {
  id: string;
  userId: string;
  testId: string;
  nickname: string;
  score: number;
  passed: boolean;
  date: string;
}

export interface Group {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface News {
  id: string;
  title: string;
  text: string;
  author: string;
  date: string;
  pinned: boolean;
  images?: string[];
}

export interface Post {
  id: string;
  sectionId: string;
  userId: string;
  text: string;
  images?: string[];
  date: string;
}

export interface Faq {
  id: string;
  q: string;
  a: string;
}

export interface TicketMessage {
  id: string;
  from: string;
  name: string;
  role: string;
  text: string;
  date: string;
  images?: string[];
}

export interface Ticket {
  id: string;
  userId: string;
  subject: string;
  status: "open" | "closed";
  messages: TicketMessage[];
  date: string;
}

export interface LogEntry {
  id: string;
  time: string;
  user: string;
  role: string;
  action: string;
  category: "auth" | "tests" | "content" | "users" | "sections" | "site" | "support" | "system";
}

export interface Settings {
  siteName: string;
  siteIcon: string; // emoji или url
  bannerDim: string;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerImage: string;
  maintenance: boolean;
  requireApproval: boolean;
  footerText?: string;
  footerLinks?: { label: string; title: string; icon: string; url: string }[];
}

export interface DB {
  settings: Settings;
  roles: Role[];
  users: User[];
  sections: Section[];
  questions: Question[];
  tests: Test[];
  results: Result[];
  groups: Group[];
  news: News[];
  faq: Faq[];
  posts?: Post[];
  tickets: Ticket[];
  logs: LogEntry[];
  sessionUserId: string | null;
}
