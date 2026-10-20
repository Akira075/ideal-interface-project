import { useEffect, useMemo, useState } from "react";
import { Gallery, ImagePicker } from "@/components/app/Media";

function shuffle<T>(a: T[]) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Icon from "@/components/ui/icon";
import { useStore } from "@/lib/store";
import { Test } from "@/lib/types";
import { uid } from "@/lib/seed";
import { cn } from "@/lib/utils";
import PageHeader, { Pill, Empty } from "@/components/app/PageHeader";
import { useTestStats } from "./Home";

function Runner({ test, onClose }: { test: Test; onClose: () => void }) {
  const { db, user, update, log } = useStore();
  const [qs] = useState(() => {
    let list = test.questionIds.map((id) => db.questions.find((q) => q.id === id)).filter(Boolean) as typeof db.questions;
    if (test.shuffleQuestions) list = shuffle(list);
    if (test.questionLimit && test.questionLimit < list.length) list = (test.shuffleQuestions ? list : shuffle(list)).slice(0, test.questionLimit);
    if (test.shuffleOptions) list = list.map((q) => ({ ...q, options: shuffle(q.options) }));
    return list;
  });
  const [left, setLeft] = useState(test.timeLimit > 0 ? test.timeLimit * 60 : 0);
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState<{ score: number; passed: boolean; ok: number } | null>(null);
  const q = qs[i];
  useEffect(() => {
    if (!test.timeLimit || done) return;
    const t = setInterval(() => setLeft((x) => x - 1), 1000);
    return () => clearInterval(t);
  }, [test.timeLimit, done]);

  const pick = (opt: string, multi: boolean) => {
    const cur = ans[q.id] || [];
    setAns({ ...ans, [q.id]: multi ? (cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]) : [opt] });
  };

  const finish = () => {
    let ok = 0;
    qs.forEach((qq) => {
      const a = (ans[qq.id] || []).map((x) => x.trim().toLowerCase());
      const c = qq.correct.map((x) => x.trim().toLowerCase());
      if (qq.type === "TEXT") {
        if (a[0] && c.includes(a[0])) ok++;
      } else if (a.length === c.length && a.every((x) => c.includes(x))) ok++;
    });
    const score = Math.round((ok / Math.max(qs.length, 1)) * 100);
    const passed = score >= test.passScore;
    setDone({ score, passed, ok });
    if (user) {
      update((d) => ({ ...d, results: [{ id: uid("r"), userId: user.id, testId: test.id, nickname: user.nickname, score, passed, date: new Date().toISOString() }, ...d.results] }));
    }
    log(`Прошёл тест «${test.title}» — ${score}%`, "tests");
  };

  useEffect(() => {
    if (test.timeLimit && left <= 0 && !done && qs.length) finish();
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl border-border bg-popover sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="font-head text-2xl font-medium">{test.title}</DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center animate-scale-in">
            <div className={cn("grid h-20 w-20 place-items-center rounded-full", done.passed ? "bg-ok/15 text-ok" : "bg-destructive/15 text-destructive")}>
              <Icon name={done.passed ? "Check" : "X"} size={36} />
            </div>
            <div className="font-head text-5xl font-medium">{done.score}%</div>
            <div className="text-sm text-muted-foreground">{done.ok} из {qs.length} баллов</div>
            <p className="text-muted-foreground">{done.passed ? "Тест пройден. Отличная работа." : `Нужно минимум ${test.passScore}%. Попробуйте ещё раз.`}</p>
            {test.showAnswers && (
              <div className="w-full space-y-2 text-left">
                {qs.map((qq) => {
                  const a = (ans[qq.id] || []).map((x) => x.trim().toLowerCase());
                  const c = qq.correct.map((x) => x.trim().toLowerCase());
                  const good = qq.type === "TEXT" ? !!a[0] && c.includes(a[0]) : a.length === c.length && a.every((x) => c.includes(x));
                  return (
                    <div key={qq.id} className={cn("rounded-xl border px-4 py-3 text-sm", good ? "border-ok/40 bg-ok/5" : "border-destructive/40 bg-destructive/5")}>
                      <div className="font-medium">{qq.title}</div>
                      <div className="mt-1 text-muted-foreground">Ваш ответ: {(ans[qq.id] || []).join(", ") || "—"}</div>
                      {!good && <div className="text-ok">Верно: {qq.correct.join(", ")}</div>}
                    </div>
                  );
                })}
              </div>
            )}
            <Pill onClick={onClose}>Готово</Pill>
          </div>
        ) : !q ? (
          <Empty text="В тесте пока нет вопросов" />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Вопрос {i + 1} из {qs.length}</span>
              {test.timeLimit > 0 ? <span className={cn("flex items-center gap-1 font-medium tabular-nums", left < 60 && "text-destructive")}><Icon name="Timer" size={14} />{Math.floor(Math.max(left, 0) / 60)}:{String(Math.max(left, 0) % 60).padStart(2, "0")}</span> : <span>{q.category}</span>}
            </div>
            <Progress value={((i + 1) / qs.length) * 100} className="h-1" />
            <h3 className="font-head text-xl font-medium">{q.title}</h3>
            {q.image && <Gallery images={[q.image]} />}
            {q.type === "TEXT" ? (
              <Input autoFocus value={(ans[q.id] || [""])[0]} onChange={(e) => setAns({ ...ans, [q.id]: [e.target.value] })} placeholder="Ваш ответ" className="rounded-xl bg-card" />
            ) : (
              <div className="space-y-2">
                {q.options.map((o) => {
                  const on = (ans[q.id] || []).includes(o);
                  return (
                    <button key={o} onClick={() => pick(o, q.type === "MULTIPLE")} className={cn("flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors", on ? "border-foreground bg-accent" : "border-border bg-card hover:border-muted-foreground")}>
                      <span className={cn("grid h-5 w-5 shrink-0 place-items-center border", q.type === "MULTIPLE" ? "rounded-md" : "rounded-full", on ? "border-foreground bg-foreground text-background" : "border-muted-foreground")}>
                        {on && <Icon name="Check" size={12} />}
                      </span>
                      {o}
                    </button>
                  );
                })}
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="ghost" className="rounded-full" disabled={i === 0} onClick={() => setI(i - 1)}>Назад</Button>
              {i < qs.length - 1 ? (
                <Button className="rounded-full px-6" disabled={!(ans[q.id] || []).length} onClick={() => setI(i + 1)}>Далее</Button>
              ) : (
                <Button className="rounded-full px-6" disabled={!(ans[q.id] || []).length} onClick={finish}>Завершить</Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TestEditor({ test, onClose }: { test: Test | null; onClose: () => void }) {
  const { db, update, log } = useStore();
  const [f, setF] = useState<Test>(
    test || { id: uid("t"), title: "", category: "", description: "", questionIds: [], passScore: 70, timeLimit: 10, maxAttempts: 0, groupCode: "", isBlocked: false, createdAt: new Date().toISOString() }
  );
  const [err, setErr] = useState("");
  const save = () => {
    if (!f.title.trim()) return setErr("Введите название");
    if (!f.questionIds.length) return setErr("Выберите хотя бы один вопрос");
    update((d) => ({ ...d, tests: test ? d.tests.map((t) => (t.id === f.id ? f : t)) : [...d.tests, f] }));
    log(test ? `Изменил тест «${f.title}»` : `Создал тест «${f.title}»`, "tests");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-border bg-popover sm:max-w-[620px]">
        <DialogHeader><DialogTitle className="font-head text-2xl font-medium">{test ? "Редактировать тест" : "Новый тест"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label>Название</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="rounded-xl bg-card" /></div>
            <div className="space-y-2"><Label>Категория</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="rounded-xl bg-card" /></div>
          </div>
          <div className="space-y-2"><Label>Описание</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="rounded-xl bg-card" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Проходной, %</Label><Input type="number" value={f.passScore} onChange={(e) => setF({ ...f, passScore: +e.target.value })} className="rounded-xl bg-card" /></div>
            <div className="space-y-2"><Label>Минут</Label><Input type="number" value={f.timeLimit} onChange={(e) => setF({ ...f, timeLimit: +e.target.value })} className="rounded-xl bg-card" /></div>
            <div className="space-y-2"><Label>Попыток (0 = ∞)</Label><Input type="number" value={f.maxAttempts} onChange={(e) => setF({ ...f, maxAttempts: +e.target.value })} className="rounded-xl bg-card" /></div>
          </div>
          <div className="space-y-2">
            <Label>Обложка теста</Label>
            {f.image && <Gallery images={[f.image]} small onRemove={() => setF({ ...f, image: "" })} />}
            <ImagePicker multiple={false} onPick={([u]) => setF({ ...f, image: u })}><Icon name="ImagePlus" size={15} />Загрузить обложку</ImagePicker>
          </div>
          <div className="space-y-2">
            <Label>Каким ролям доступен</Label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setF({ ...f, roles: [] })} className={cn("rounded-full border px-3.5 py-1.5 text-sm", !(f.roles || []).length ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground")}>Всем</button>
              {db.roles.map((r) => {
                const on = (f.roles || []).includes(r.id);
                return <button key={r.id} onClick={() => setF({ ...f, roles: on ? (f.roles || []).filter((x) => x !== r.id) : [...(f.roles || []), r.id] })} className={cn("rounded-full border px-3.5 py-1.5 text-sm", on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground")}>{r.icon} {r.name}</button>;
              })}
            </div>
          </div>
          <div className="grid gap-2 rounded-xl bg-card p-3 sm:grid-cols-2">
            {([["shuffleQuestions", "Перемешивать вопросы"], ["shuffleOptions", "Перемешивать варианты"], ["showAnswers", "Показать разбор ответов в конце"], ["isBlocked", "Тест заблокирован"]] as const).map(([k, l]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={!!f[k]} onCheckedChange={(v) => setF({ ...f, [k]: !!v })} />{l}</label>
            ))}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">Случайных вопросов из выбранных (0 = все):<Input type="number" value={f.questionLimit || 0} onChange={(e) => setF({ ...f, questionLimit: +e.target.value })} className="h-8 w-20 rounded-lg bg-background" /></label>
          </div>
          <div className="space-y-2">
            <Label>Группа (доступ)</Label>
            <div className="flex flex-wrap gap-2">
              {[{ code: "", name: "Все" }, ...db.groups].map((g) => (
                <button key={g.code} onClick={() => setF({ ...f, groupCode: g.code })} className={cn("rounded-full border px-3.5 py-1.5 text-sm", f.groupCode === g.code ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground")}>{g.name}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Вопросы ({f.questionIds.length})</Label>
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl bg-card p-2">
              {db.questions.map((q) => (
                <label key={q.id} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-accent">
                  <Checkbox checked={f.questionIds.includes(q.id)} onCheckedChange={(v) => setF({ ...f, questionIds: v ? [...f.questionIds, q.id] : f.questionIds.filter((x) => x !== q.id) })} className="mt-0.5" />
                  <span className="text-sm">{q.title}</span>
                </label>
              ))}
            </div>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" className="rounded-full" onClick={onClose}>Отмена</Button>
          <Button className="rounded-full px-6" onClick={save}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestRow({ t, onRun, onEdit }: { t: Test; onRun: () => void; onEdit?: () => void }) {
  const { db, user, update, log } = useStore();
  const s = useTestStats(t.id);
  const group = db.groups.find((g) => g.code === t.groupCode);
  const { previewRole } = usePreview();
  const myRoles = previewRole ? [previewRole] : user ? [user.role, ...(user.extraRoles || [])] : [];
  const isDev = !previewRole && user?.role === "dev";
  const roleLocked = !!t.roles?.length && !isDev && !t.roles.some((r) => myRoles.includes(r));
  const myTries = db.results.filter((r) => r.testId === t.id && r.userId === user?.id).length;
  const triesOut = !!t.maxAttempts && myTries >= t.maxAttempts && !isDev;
  const locked = roleLocked || triesOut || (!!t.groupCode && !isDev && !(user?.groups || []).includes(t.groupCode));
  const blocked = t.isBlocked && user?.role !== "dev";
  return (
    <div className="group flex flex-col gap-4 overflow-hidden rounded-2xl bg-card p-5 transition-transform duration-300 hover:-translate-y-0.5 animate-fade-in">
      {t.image && <img src={t.image} alt="" className="-mx-5 -mt-5 h-36 w-[calc(100%+2.5rem)] max-w-none object-cover" />}
      <div className="flex items-start justify-between gap-3">
        <small className="text-[0.85em] text-muted-foreground">{t.category}</small>
        <div className="flex gap-1">
          {t.isBlocked && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">Заблокирован</span>}
          {group && <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">{group.name}</span>}
          {(t.roles || []).map((rid) => { const r = db.roles.find((x) => x.id === rid); return r ? <span key={rid} className="rounded-full px-2 py-0.5 text-xs" style={{ background: `hsl(${r.color} / 0.15)`, color: `hsl(${r.color})` }}>{r.icon} {r.name}</span> : null; })}
        </div>
      </div>
      <div>
        <b className="font-head text-[1.3em] font-medium">{t.title}</b>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Icon name="ListChecks" size={13} />{t.questionIds.length} вопр.</span>
        <span className="flex items-center gap-1"><Icon name="Timer" size={13} />{t.timeLimit} мин</span>
        <span className="flex items-center gap-1"><Icon name="Target" size={13} />от {t.passScore}%</span>
        <span className="flex items-center gap-1"><Icon name="RotateCcw" size={13} />{t.maxAttempts ? `${myTries}/${t.maxAttempts}` : "∞"} попыт.</span>
        {!!t.questionLimit && <span className="flex items-center gap-1"><Icon name="Shuffle" size={13} />{t.questionLimit} случ.</span>}
      </div>
      <div className="h-1 rounded bg-border"><i className="block h-full rounded bg-foreground" style={{ width: `${s.pct}%` }} /></div>
      <div className="flex items-center justify-between gap-2">
        <small className={cn("text-[0.85em]", s.pct >= 90 ? "text-ok" : "text-muted-foreground")}>{s.passed} из {s.total} прошли</small>
        <div className="flex gap-1.5">
          {onEdit && (
            <>
              <button onClick={() => { update((d) => ({ ...d, tests: d.tests.map((x) => (x.id === t.id ? { ...x, isBlocked: !x.isBlocked } : x)) })); log(`${t.isBlocked ? "Разблокировал" : "Заблокировал"} тест «${t.title}»`, "tests"); }} className="grid h-9 w-9 place-items-center rounded-full bg-accent text-muted-foreground hover:text-foreground" title="Блокировка"><Icon name={t.isBlocked ? "Unlock" : "Lock"} size={14} /></button>
              <button onClick={onEdit} className="grid h-9 w-9 place-items-center rounded-full bg-accent text-muted-foreground hover:text-foreground" title="Редактировать"><Icon name="Pencil" size={14} /></button>
            </>
          )}
          <button disabled={locked || blocked || !user || !!previewRole} onClick={onRun} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
            {!user ? "Войдите" : triesOut ? "Попытки исчерпаны" : locked ? "Нет доступа" : "Начать"}
          </button>
        </div>
      </div>
    </div>
  );
}

let previewSetter: (r: string) => void = () => undefined;
let previewValue = "";
function usePreview() {
  return { previewRole: previewValue, setPreviewRole: previewSetter };
}

export default function Tests() {
  const { db, can } = useStore();
  const [previewRole, setPreviewRole] = useState("");
  previewValue = previewRole;
  previewSetter = setPreviewRole;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [run, setRun] = useState<Test | null>(null);
  const [edit, setEdit] = useState<Test | null | "new">(null);
  const cats = useMemo(() => Array.from(new Set(db.tests.map((t) => t.category))), [db.tests]);
  const list = db.tests.filter((t) => (!cat || t.category === cat) && t.title.toLowerCase().includes(q.toLowerCase()) && (!previewRole || !t.roles?.length || t.roles.includes(previewRole)) && (!previewRole || !t.isBlocked));
  const manage = can("tests.manage");

  return (
    <div className="px-4 py-10 md:px-9">
      <PageHeader title="Все тесты" subtitle="Выберите тест и проверьте свои знания." actions={manage && <Pill onClick={() => setEdit("new")}><Icon name="Plus" size={16} />Новый тест</Pill>} />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Icon name="Search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск теста" className="rounded-full bg-card pl-10" />
        </div>
        {manage && (
          <select value={previewRole} onChange={(e) => setPreviewRole(e.target.value)} className="rounded-full border border-border bg-card px-4 py-2 text-sm outline-none" title="Посмотреть, что видит роль">
            <option value="">Вид: как у меня</option>
            {db.roles.map((r) => <option key={r.id} value={r.id}>Вид глазами: {r.icon} {r.name}</option>)}
          </select>
        )}
        <div className="flex flex-wrap gap-2">
          {["", ...cats].map((c) => (
            <button key={c || "all"} onClick={() => setCat(c)} className={cn("rounded-full px-3.5 py-1.5 text-sm transition-colors", cat === c ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground")}>{c || "Все"}</button>
          ))}
        </div>
      </div>
      {list.length ? (
        <div className="grid gap-3.5 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((t) => <TestRow key={t.id} t={t} onRun={() => setRun(t)} onEdit={manage ? () => setEdit(t) : undefined} />)}
        </div>
      ) : <Empty text="Ничего не найдено" />}
      {run && <Runner test={run} onClose={() => setRun(null)} />}
      {edit && <TestEditor test={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
