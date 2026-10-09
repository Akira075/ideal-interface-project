import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useStore, fmtTime } from "@/lib/store";
import { cn } from "@/lib/utils";
import PageHeader, { Pill, Empty } from "@/components/app/PageHeader";

export default function Results() {
  const { db, user, can, update, log } = useStore();
  const all = can("results.viewAll");
  const [mine, setMine] = useState(!all);
  const list = db.results.filter((r) => !mine || r.userId === user?.id).slice(0, 100);
  const passed = list.filter((r) => r.passed).length;
  const avg = list.length ? Math.round(list.reduce((s, r) => s + r.score, 0) / list.length) : 0;

  return (
    <div className="px-4 py-10 md:px-9">
      <PageHeader
        title="Результаты"
        subtitle="Итоги всех прохождений — честно и по делу."
        actions={
          all && (
            <>
              <Pill variant={mine ? "ghost" : "white"} onClick={() => setMine(false)}>Все</Pill>
              <Pill variant={mine ? "white" : "ghost"} onClick={() => setMine(true)}>Мои</Pill>
              {user?.role === "dev" && <Pill variant="outline" onClick={() => { update((d) => ({ ...d, results: [] })); log("Очистил все результаты", "tests"); }}><Icon name="Trash2" size={14} />Очистить</Pill>}
            </>
          )
        }
      />
      <div className="mb-6 grid grid-cols-3 gap-3.5">
        {[
          { v: list.length, l: "прохождений" },
          { v: passed, l: "успешно" },
          { v: avg + "%", l: "средний балл" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl bg-card px-5 py-4">
            <b className="block font-head text-[2em] font-medium tracking-[-0.02em]">{s.v}</b>
            <small className="text-[0.85em] text-muted-foreground">{s.l}</small>
          </div>
        ))}
      </div>
      {list.length ? (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] text-left">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-5 py-3 font-medium">Пользователь</th><th className="px-5 py-3 font-medium">Тест</th><th className="px-5 py-3 font-medium">Балл</th><th className="px-5 py-3 font-medium">Статус</th><th className="px-5 py-3 font-medium">Когда</th></tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t border-border transition-colors hover:bg-card">
                  <td className="px-5 py-3">{r.nickname}</td>
                  <td className="px-5 py-3 text-muted-foreground">{db.tests.find((t) => t.id === r.testId)?.title || "—"}</td>
                  <td className="px-5 py-3 font-head">{r.score}%</td>
                  <td className="px-5 py-3"><span className={cn("rounded-full px-2.5 py-0.5 text-xs", r.passed ? "bg-ok/15 text-ok" : "bg-destructive/15 text-destructive")}>{r.passed ? "Сдан" : "Не сдан"}</span></td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{fmtTime(r.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty text="Пока нет результатов — пройдите первый тест" />}
    </div>
  );
}
