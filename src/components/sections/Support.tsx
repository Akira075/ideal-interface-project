import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Icon from "@/components/ui/icon";
import { useStore, fmtTime } from "@/lib/store";
import { uid } from "@/lib/seed";
import { cn } from "@/lib/utils";
import PageHeader, { Pill, Empty } from "@/components/app/PageHeader";

export default function Support() {
  const { db, user, can, update, log, roleOf } = useStore();
  const staff = can("tickets.manage");
  const tickets = db.tickets.filter((t) => staff || t.userId === user?.id).sort((a, b) => b.date.localeCompare(a.date));
  const [active, setActive] = useState<string | null>(tickets[0]?.id || null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const t = db.tickets.find((x) => x.id === active);

  if (!user) return <div className="px-4 py-10 md:px-9"><PageHeader title="Поддержка" /><Empty text="Войдите, чтобы создать обращение" /></div>;

  const create = () => {
    if (!subject.trim() || !body.trim()) return;
    const id = uid("k");
    const now = new Date().toISOString();
    update((d) => ({ ...d, tickets: [{ id, userId: user.id, subject, status: "open", date: now, messages: [{ id: uid("m"), from: user.id, name: user.nickname, role: user.role, text: body, date: now }] }, ...d.tickets] }));
    log(`Создал обращение «${subject}»`, "support");
    setSubject(""); setBody(""); setCreating(false); setActive(id);
  };

  const send = () => {
    if (!reply.trim() || !t) return;
    const now = new Date().toISOString();
    update((d) => ({ ...d, tickets: d.tickets.map((x) => (x.id === t.id ? { ...x, messages: [...x.messages, { id: uid("m"), from: user.id, name: user.nickname, role: user.role, text: reply, date: now }] } : x)) }));
    log(`Ответил в обращении «${t.subject}»`, "support");
    setReply("");
  };

  const toggleStatus = () => {
    if (!t) return;
    update((d) => ({ ...d, tickets: d.tickets.map((x) => (x.id === t.id ? { ...x, status: x.status === "open" ? "closed" : "open" } : x)) }));
    log(`${t.status === "open" ? "Закрыл" : "Открыл"} обращение «${t.subject}»`, "support");
  };

  return (
    <div className="px-4 py-10 md:px-9">
      <PageHeader title="Поддержка" subtitle="Опишите проблему — команда ответит здесь же." actions={<Pill onClick={() => setCreating(true)}><Icon name="Plus" size={16} />Обращение</Pill>} />
      <div className="grid gap-3.5 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          {tickets.length ? tickets.map((x) => (
            <button key={x.id} onClick={() => { setActive(x.id); setCreating(false); }} className={cn("w-full rounded-2xl p-4 text-left transition-colors", active === x.id && !creating ? "bg-accent" : "bg-card hover:bg-accent/60")}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{x.subject}</span>
                <span className={cn("h-2 w-2 shrink-0 rounded-full", x.status === "open" ? "bg-ok" : "bg-muted-foreground")} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{x.messages.length} сообщ. · {fmtTime(x.date)}</div>
            </button>
          )) : <Empty text="Обращений нет" />}
        </div>
        <div className="min-h-[420px] rounded-2xl bg-card p-5">
          {creating ? (
            <div className="space-y-3 animate-fade-in">
              <h3 className="font-head text-xl font-medium">Новое обращение</h3>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Тема" className="rounded-xl bg-background" />
              <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Опишите, что случилось" className="rounded-xl bg-background" />
              <div className="flex justify-end gap-2"><Pill variant="ghost" onClick={() => setCreating(false)}>Отмена</Pill><Pill onClick={create}>Отправить</Pill></div>
            </div>
          ) : t ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
                <h3 className="font-head text-xl font-medium">{t.subject}</h3>
                {staff && <Pill variant="outline" onClick={toggleStatus} className="text-sm">{t.status === "open" ? "Закрыть" : "Открыть снова"}</Pill>}
              </div>
              <div className="flex-1 space-y-3 py-4">
                {t.messages.map((m) => {
                  const mine = m.from === user.id;
                  const r = roleOf(m.role);
                  return (
                    <div key={m.id} className={cn("max-w-[85%] rounded-2xl px-4 py-3", mine ? "ml-auto bg-primary text-primary-foreground" : "bg-accent")}>
                      <div className={cn("mb-1 flex items-center gap-2 text-xs", mine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                        <span className="font-medium">{m.name}</span>{r && <span>· {r.name}</span>}<span>· {fmtTime(m.date)}</span>
                      </div>
                      {m.text}
                    </div>
                  );
                })}
              </div>
              {t.status === "open" ? (
                <div className="flex gap-2 border-t border-border pt-4">
                  <Input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ваш ответ" className="rounded-full bg-background" />
                  <button onClick={send} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Icon name="ArrowUp" size={18} /></button>
                </div>
              ) : <p className="border-t border-border pt-4 text-center text-sm text-muted-foreground">Обращение закрыто</p>}
            </div>
          ) : <div className="grid h-full place-items-center text-muted-foreground">Выберите обращение слева</div>}
        </div>
      </div>
    </div>
  );
}
