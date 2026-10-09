import { useStore } from "@/lib/store";
import { Pill } from "@/components/app/PageHeader";

export function useTestStats(testId: string) {
  const { db } = useStore();
  const rs = db.results.filter((r) => r.testId === testId);
  const passed = rs.filter((r) => r.passed).length;
  return { total: rs.length, passed, pct: rs.length ? Math.round((passed / rs.length) * 100) : 0 };
}

function TestCard({ id, i }: { id: string; i: number }) {
  const { db, setView } = useStore();
  const t = db.tests.find((x) => x.id === id)!;
  const s = useTestStats(id);
  const ok = s.total > 0 && s.pct >= 90;
  return (
    <button
      onClick={() => setView("tests")}
      style={{ animationDelay: `${150 + i * 80}ms` }}
      className="flex min-h-[170px] flex-col justify-between gap-4 rounded-2xl bg-card p-5 text-left transition-transform duration-300 hover:-translate-y-1 animate-fade-in"
    >
      <small className="text-[0.85em] text-muted-foreground">{t.category}</small>
      <b className="font-head text-[1.25em] font-medium">{t.title}</b>
      <div className="h-1 rounded bg-border">
        <i className="block h-full rounded bg-foreground transition-all duration-700" style={{ width: `${s.pct}%` }} />
      </div>
      <small className={`text-[0.85em] ${ok ? "text-ok" : "text-muted-foreground"}`}>
        {s.passed} из {s.total} прошли
      </small>
    </button>
  );
}

export default function Home() {
  const { db, setView, can } = useStore();
  const st = db.settings;
  const today = new Date().toDateString();
  const logsToday = db.logs.filter((l) => new Date(l.time).toDateString() === today).length;
  const okRate = db.results.length ? Math.round((db.results.filter((r) => r.passed).length / db.results.length) * 100) : 0;
  const lines = st.bannerTitle.split("\n");

  return (
    <div className="flex min-h-[calc(100vh-68px)] flex-col">
      <section
        className="banner-glow relative flex flex-1 flex-col items-center justify-center gap-[18px] overflow-hidden px-6 py-20 text-center"
        style={st.bannerImage ? { backgroundImage: `linear-gradient(hsl(0 0% 0% / .6), hsl(0 0% 0% / .85)), url(${st.bannerImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      >
        <h1 className="font-head text-[38px] font-medium leading-[1.08] tracking-[-0.025em] sm:text-[48px] xl:text-[56px] animate-fade-in">
          <span className="text-muted-foreground">{st.bannerDim}</span> {lines[0]}
          {lines.slice(1).map((l, i) => (
            <span key={i}>
              <br />
              {l}
            </span>
          ))}
        </h1>
        <p className="max-w-xl animate-fade-in" style={{ animationDelay: "80ms" }}>{st.bannerSubtitle}</p>
        <div className="mt-1.5 flex flex-wrap justify-center gap-2 animate-fade-in" style={{ animationDelay: "140ms" }}>
          <Pill onClick={() => setView("tests")} className="px-10 py-[13px] text-[1.05em]">Запустить тест</Pill>
          <Pill variant="outline" onClick={() => setView(can("logs.view") ? "dev" : "results")} className="px-10 py-[13px] text-[1.05em]">
            {can("logs.view") ? "Открыть логи" : "Мои результаты"}
          </Pill>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3.5 px-4 pb-8 sm:grid-cols-2 md:px-9 xl:grid-cols-[repeat(3,1fr)_240px]">
        {db.tests.slice(0, 3).map((t, i) => (
          <TestCard key={t.id} id={t.id} i={i} />
        ))}
        <div className="flex flex-col gap-3.5 animate-fade-in" style={{ animationDelay: "400ms" }}>
          <div className="flex-1 rounded-2xl bg-card px-5 py-4">
            <b className="block font-head text-[2em] font-medium tracking-[-0.02em]">{logsToday.toLocaleString("ru-RU")}</b>
            <small className="text-[0.85em] text-muted-foreground">записей в логах сегодня</small>
          </div>
          <div className="flex-1 rounded-2xl bg-card px-5 py-4">
            <b className="block font-head text-[2em] font-medium tracking-[-0.02em]">{okRate}%</b>
            <small className="text-[0.85em] text-muted-foreground">успешных прогонов</small>
          </div>
        </div>
      </section>
    </div>
  );
}
