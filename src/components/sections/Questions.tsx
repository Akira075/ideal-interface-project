import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { useStore } from "@/lib/store";
import { Question, QType } from "@/lib/types";
import { uid } from "@/lib/seed";
import { cn } from "@/lib/utils";
import PageHeader, { Pill, Empty } from "@/components/app/PageHeader";

const TYPES: { id: QType; label: string }[] = [
  { id: "SINGLE", label: "Один ответ" },
  { id: "MULTIPLE", label: "Несколько" },
  { id: "BOOLEAN", label: "Да / Нет" },
  { id: "TEXT", label: "Текст" },
];

function Editor({ q, onClose }: { q: Question | null; onClose: () => void }) {
  const { update, log } = useStore();
  const [f, setF] = useState<Question>(q || { id: uid("q"), title: "", category: "", type: "SINGLE", options: ["", ""], correct: [], createdAt: new Date().toISOString() });
  const [err, setErr] = useState("");
  const save = () => {
    const opts = f.options.map((o) => o.trim()).filter(Boolean);
    const data = { ...f, options: f.type === "TEXT" ? [] : opts, correct: f.correct.map((c) => c.trim()).filter(Boolean) };
    if (!data.title.trim()) return setErr("Введите текст вопроса");
    if (!data.correct.length) return setErr("Укажите правильный ответ");
    update((d) => ({ ...d, questions: q ? d.questions.map((x) => (x.id === f.id ? data : x)) : [...d.questions, data] }));
    log(q ? "Изменил вопрос в банке" : "Добавил вопрос в банк", "content");
    onClose();
  };
  const toggle = (o: string) => {
    if (f.type === "MULTIPLE") setF({ ...f, correct: f.correct.includes(o) ? f.correct.filter((c) => c !== o) : [...f.correct, o] });
    else setF({ ...f, correct: [o] });
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-border bg-popover sm:max-w-[580px]">
        <DialogHeader><DialogTitle className="font-head text-2xl font-medium">{q ? "Вопрос" : "Новый вопрос"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Текст вопроса</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="rounded-xl bg-card" /></div>
          <div className="space-y-2"><Label>Категория</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="rounded-xl bg-card" /></div>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button key={t.id} onClick={() => setF({ ...f, type: t.id, correct: [], options: t.id === "BOOLEAN" ? ["Да", "Нет"] : f.options })} className={cn("rounded-full border px-3.5 py-1.5 text-sm", f.type === t.id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground")}>{t.label}</button>
            ))}
          </div>
          {f.type === "TEXT" ? (
            <div className="space-y-2"><Label>Правильные ответы через запятую</Label><Input value={f.correct.join(", ")} onChange={(e) => setF({ ...f, correct: e.target.value.split(",") })} className="rounded-xl bg-card" /></div>
          ) : (
            <div className="space-y-2">
              <Label>Варианты (нажмите на кружок — отметить верный)</Label>
              {f.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button onClick={() => o.trim() && toggle(o)} className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border", f.correct.includes(o) && o ? "border-ok bg-ok text-background" : "border-muted-foreground")}>
                    {f.correct.includes(o) && o && <Icon name="Check" size={12} />}
                  </button>
                  <Input value={o} onChange={(e) => { const opts = [...f.options]; opts[i] = e.target.value; setF({ ...f, options: opts, correct: f.correct.filter((c) => c !== o) }); }} className="rounded-xl bg-card" />
                  {f.type !== "BOOLEAN" && <button onClick={() => setF({ ...f, options: f.options.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive"><Icon name="X" size={16} /></button>}
                </div>
              ))}
              {f.type !== "BOOLEAN" && <button onClick={() => setF({ ...f, options: [...f.options, ""] })} className="text-sm text-muted-foreground hover:text-foreground">+ Добавить вариант</button>}
            </div>
          )}
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

export default function Questions() {
  const { db, update, log } = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Question | null | "new">(null);
  const list = db.questions.filter((x) => x.title.toLowerCase().includes(q.toLowerCase()) || x.category.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="px-4 py-10 md:px-9">
      <PageHeader title="Банк вопросов" subtitle={`${db.questions.length} вопросов — основа для любых тестов.`} actions={<Pill onClick={() => setEdit("new")}><Icon name="Plus" size={16} />Вопрос</Pill>} />
      <div className="relative mb-6 max-w-sm">
        <Icon name="Search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по вопросам" className="rounded-full bg-card pl-10" />
      </div>
      {list.length ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          {list.map((x, i) => (
            <div key={x.id} className={cn("flex items-center gap-4 px-5 py-4 transition-colors hover:bg-card", i && "border-t border-border")}>
              <span className="w-8 shrink-0 font-head text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate">{x.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{x.category} · {TYPES.find((t) => t.id === x.type)?.label}</div>
              </div>
              <button onClick={() => setEdit(x)} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Icon name="Pencil" size={14} /></button>
              <button onClick={() => { update((d) => ({ ...d, questions: d.questions.filter((y) => y.id !== x.id) })); log("Удалил вопрос из банка", "content"); }} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-destructive"><Icon name="Trash2" size={14} /></button>
            </div>
          ))}
        </div>
      ) : <Empty text="Вопросов не найдено" />}
      {edit && <Editor q={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
