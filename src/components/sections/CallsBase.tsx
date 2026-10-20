import { useState } from "react";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { useStore, fmtTime } from "@/lib/store";
import { cn } from "@/lib/utils";
import PageHeader, { Pill, Empty } from "@/components/app/PageHeader";

export default function CallsBase() {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const [test, setTest] = useState("");
  const rows = db.results
    .filter((r) => (!test || r.testId === test))
    .filter((r) => {
      const s = q.toLowerCase();
      return !s || (r.code || "").toLowerCase().includes(s) || r.nickname.toLowerCase().includes(s) || (r.form?.[0]?.value || "").toLowerCase().includes(s);
    });

  const csv = () => {
    const head = ["ID", "Кандидат", "Провёл", "Тест", "Баллы", "%", "Статус", "Дата"];
    const lines = rows.map((r) => [r.code || "", r.form?.[0]?.value || "", r.nickname, db.tests.find((t) => t.id === r.testId)?.title || "", `${r.correct ?? ""}/${r.total ?? ""}`, r.score, r.passed ? "Сдан" : "Не сдан", fmtTime(r.date)].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    const blob = new Blob(["\ufeff" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "baza-obzvonov.csv";
    a.click();
  };

  return (
    <div className="px-4 py-10 md:px-9">
      <PageHeader title="База обзвонов" subtitle="ID прохождений, кандидаты и баллы." actions={<Pill variant="ghost" onClick={csv}><Icon name="Download" size={14} />CSV</Pill>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Icon name="Search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по ID (T-00001) или имени" className="rounded-full bg-card pl-10" />
        </div>
        <select value={test} onChange={(e) => setTest(e.target.value)} className="rounded-full border border-border bg-card px-4 text-sm outline-none">
          <option value="">Все тесты</option>
          {db.tests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </div>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="grid gap-2 rounded-2xl bg-card px-5 py-3.5 md:grid-cols-[110px_1.3fr_1fr_1.3fr_90px_100px_120px] md:items-center">
              <span className="font-mono text-sm text-glow">{r.code || "—"}</span>
              <span className="font-medium">{r.form?.[0]?.value || "—"}{r.form && r.form.length > 1 && <span className="block text-xs font-normal text-muted-foreground">{r.form.slice(1).map((f) => `${f.label}: ${f.value}`).join(" · ")}</span>}</span>
              <span className="text-sm text-muted-foreground">{r.nickname}</span>
              <span className="text-sm">{db.tests.find((t) => t.id === r.testId)?.title || "—"}</span>
              <span className="font-head">{r.correct ?? "?"}/{r.total ?? "?"} · {r.score}%</span>
              <span><span className={cn("rounded-full px-2.5 py-0.5 text-xs", r.passed ? "bg-ok/15 text-ok" : "bg-destructive/15 text-destructive")}>{r.passed ? "Сдан" : "Не сдан"}</span></span>
              <span className="text-sm text-muted-foreground">{fmtTime(r.date)}</span>
            </div>
          ))}
        </div>
      ) : <Empty text="Прохождений пока нет" />}
    </div>
  );
}
