import { useState } from "react";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { useStore, fmtTime } from "@/lib/store";
import { LogEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Pill, Empty } from "@/components/app/PageHeader";

const CATS: { id: LogEntry["category"] | ""; label: string; icon: string }[] = [
  { id: "", label: "Все", icon: "List" },
  { id: "auth", label: "Входы", icon: "KeyRound" },
  { id: "tests", label: "Тесты", icon: "ClipboardCheck" },
  { id: "content", label: "Контент", icon: "FileText" },
  { id: "users", label: "Пользователи", icon: "Users" },
  { id: "sections", label: "Разделы", icon: "LayoutGrid" },
  { id: "site", label: "Сайт", icon: "Palette" },
  { id: "support", label: "Поддержка", icon: "LifeBuoy" },
  { id: "system", label: "Система", icon: "Cpu" },
];

export default function LogsPanel() {
  const { db, update, log, roleOf } = useStore();
  const [cat, setCat] = useState<string>("");
  const [q, setQ] = useState("");
  const list = db.logs.filter((l) => (!cat || l.category === cat) && (l.user + l.action).toLowerCase().includes(q.toLowerCase()));

  const exportCsv = () => {
    const rows = [["Время", "Пользователь", "Роль", "Категория", "Действие"], ...list.map((l) => [l.time, l.user, l.role, l.category, l.action])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    a.download = "uia-logs.csv";
    a.click();
    log("Выгрузил журнал действий в CSV", "system");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-sm flex-1">
          <Icon name="Search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Кто или что сделал" className="rounded-full bg-card pl-10" />
        </div>
        <div className="flex gap-2">
          <Pill variant="ghost" onClick={exportCsv}><Icon name="Download" size={14} />CSV</Pill>
          <Pill variant="outline" onClick={() => { update((d) => ({ ...d, logs: [] })); setTimeout(() => log("Очистил журнал действий", "system"), 0); }}><Icon name="Trash2" size={14} />Очистить</Pill>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {CATS.map((c) => {
          const n = c.id ? db.logs.filter((l) => l.category === c.id).length : db.logs.length;
          return (
            <button key={c.id || "all"} onClick={() => setCat(c.id)} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors", cat === c.id ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground")}>
              <Icon name={c.icon} size={13} />{c.label}<span className="opacity-60">{n}</span>
            </button>
          );
        })}
      </div>
      {list.length ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          {list.slice(0, 200).map((l, i) => {
            const r = roleOf(l.role);
            const c = CATS.find((x) => x.id === l.category);
            return (
              <div key={l.id} className={cn("grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors hover:bg-card sm:grid-cols-[110px_auto_1fr_auto]", i && "border-t border-border")}>
                <span className="hidden font-mono text-xs text-muted-foreground sm:block">{fmtTime(l.time)}</span>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-card text-muted-foreground"><Icon name={c?.icon || "Circle"} size={14} /></span>
                <div className="min-w-0">
                  <div className="truncate">{l.action}</div>
                  <div className="text-xs text-muted-foreground sm:hidden">{fmtTime(l.time)}</div>
                </div>
                <div className="col-span-2 flex items-center gap-2 text-sm sm:col-span-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: r ? `hsl(${r.color})` : "hsl(var(--muted-foreground))" }} />
                  <span className="font-medium">{l.user}</span>
                  <span className="text-muted-foreground">{r?.name || (l.role === "system" ? "Система" : "Гость")}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : <Empty text="Записей нет" />}
    </div>
  );
}
