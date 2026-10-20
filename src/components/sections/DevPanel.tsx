import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import PageHeader, { Empty } from "@/components/app/PageHeader";
import LogsPanel from "@/components/dev/LogsPanel";
import SectionsPanel from "@/components/dev/SectionsPanel";
import { RolesPanel, UsersPanel, OnlinePanel } from "@/components/dev/RolesPanel";
import SitePanel from "@/components/dev/SitePanel";
import ConsolePanel from "@/components/dev/ConsolePanel";

const TABS = [
  { id: "logs", label: "Журнал UIA", icon: "ScrollText", perm: "logs.view" },
  { id: "sections", label: "Разделы", icon: "LayoutGrid", perm: "sections.manage" },
  { id: "roles", label: "Роли", icon: "ShieldCheck", perm: "roles.manage" },
  { id: "users", label: "Пользователи", icon: "Users", perm: "users.manage" },
  { id: "online", label: "Онлайн", icon: "Radio", perm: "users.manage" },
  { id: "site", label: "Сайт, баннер, подвал", icon: "Palette", perm: "site.manage" },
  { id: "console", label: "Консоль", icon: "Terminal", perm: "site.manage" },
] as const;

export default function DevPanel() {
  const { db, can } = useStore();
  const tabs = TABS.filter((t) => can(t.perm));
  const [tab, setTab] = useState<string>(tabs[0]?.id || "logs");
  if (!tabs.length) return <div className="px-4 py-10 md:px-9"><Empty text="Нет доступа к панели разработчика" /></div>;

  const stats = [
    { v: db.users.length, l: "пользователей" },
    { v: db.tests.length, l: "тестов" },
    { v: db.sections.length, l: "разделов" },
    { v: db.logs.length, l: "записей в журнале" },
  ];

  return (
    <div className="px-4 py-10 md:px-9">
      <PageHeader title="Админ-панель" subtitle="Полное управление: разделы, роли, пользователи, сайт и консоль команд." />
      <div className="mb-6 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.l} className="rounded-2xl bg-card px-5 py-4">
            <b className="block font-head text-[2em] font-medium tracking-[-0.02em]">{s.v}</b>
            <small className="text-[0.85em] text-muted-foreground">{s.l}</small>
          </div>
        ))}
      </div>
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-full bg-card p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors", tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Icon name={t.icon} size={15} />{t.label}
          </button>
        ))}
      </div>
      <div key={tab} className="animate-fade-in">
        {tab === "logs" && <LogsPanel />}
        {tab === "sections" && <SectionsPanel />}
        {tab === "roles" && <RolesPanel />}
        {tab === "users" && <UsersPanel />}
        {tab === "online" && <OnlinePanel />}
        {tab === "site" && <SitePanel />}
        {tab === "console" && <ConsolePanel />}
      </div>
    </div>
  );
}
