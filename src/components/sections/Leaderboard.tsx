import { useState } from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import PageHeader, { Empty } from "@/components/app/PageHeader";
import { Avatar } from "@/components/app/Media";

export default function Leaderboard() {
  const { db, openProfile } = useStore();
  const [test, setTest] = useState("");
  const g: Record<string, { id: string; nickname: string; attempts: number; passed: number; sum: number; best: number }> = {};
  db.results.filter((r) => !test || r.testId === test).forEach((r) => {
    const x = (g[r.userId] ||= { id: r.userId, nickname: r.nickname, attempts: 0, passed: 0, sum: 0, best: 0 });
    x.attempts++;
    x.passed += r.passed ? 1 : 0;
    x.sum += r.score;
    x.best = Math.max(x.best, r.score);
  });
  const rows = Object.values(g).map((x) => ({ ...x, avg: Math.round(x.sum / x.attempts) })).sort((a, b) => b.passed - a.passed || b.avg - a.avg).slice(0, 100);
  const medal = ["🥇", "🥈", "🥉"];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-9">
      <PageHeader title="Рейтинг" subtitle="Кто прошёл больше всего тестов." actions={
        <select value={test} onChange={(e) => setTest(e.target.value)} className="rounded-full border border-border bg-card px-4 py-2 text-sm outline-none">
          <option value="">По всем тестам</option>
          {db.tests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      } />
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.id} className={cn("flex items-center gap-4 rounded-2xl bg-card px-5 py-3", i < 3 && "border border-glow/30")}>
              <span className="w-8 text-center font-head text-lg">{medal[i] || i + 1}</span>
              <Avatar u={db.users.find((u) => u.id === r.id)} size={36} onClick={() => openProfile(r.id)} />
              <span className="flex-1 truncate font-medium">{r.nickname}</span>
              <span className="hidden text-sm text-muted-foreground sm:block">{r.attempts} попыт.</span>
              <span className="text-sm text-ok">{r.passed} сдано</span>
              <span className="w-16 text-right font-head">{r.avg}%</span>
            </div>
          ))}
        </div>
      ) : <Empty text="Пока нет прохождений" />}
    </div>
  );
}
