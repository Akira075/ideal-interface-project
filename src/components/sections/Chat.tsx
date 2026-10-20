import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { useStore, fmtTime } from "@/lib/store";
import { cn } from "@/lib/utils";
import PageHeader, { Empty } from "@/components/app/PageHeader";
import { Avatar } from "@/components/app/Media";
import { CHAT_URL, withQuery } from "@/lib/api";


interface Msg { id: number | string; seq?: number; userId: string; nickname: string; text: string; mentions: string[]; date: string; role: string }
interface ChatUser { id: string; nickname: string; role: string }

const headers = () => ({ "Content-Type": "application/json", "X-Auth-Token": localStorage.getItem("testpad_token") || "" });

function Highlight({ text, myNick }: { text: string; myNick: string }) {
  return (
    <>
      {text.split(/(@[\p{L}\p{N}_]+)/u).map((p, i) =>
        p.startsWith("@") ? <span key={i} className={cn("rounded px-1 font-medium", p.slice(1).toLowerCase() === myNick.toLowerCase() || ["all", "все"].includes(p.slice(1).toLowerCase()) ? "bg-glow/30 text-foreground" : "bg-accent text-glow")}>{p}</span> : p
      )}
    </>
  );
}

export default function Chat() {
  const { user, can, openProfile, db, roleOf } = useStore();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);

  const load = async () => {
    const r = await fetch(withQuery(CHAT_URL, `since=${lastId.current}`), { headers: headers() });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(d.error || "Чат недоступен");
    setErr("");
    setUsers(d.users || []);
    if (d.messages?.length) {
      const lm = d.messages[d.messages.length - 1];
      lastId.current = Number(lm.seq ?? lm.id);
      setMsgs((m) => [...m, ...d.messages].slice(-300));
      setTimeout(() => box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }), 50);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const m = text.match(/@([\p{L}\p{N}_]*)$/u);
  const hints = m ? users.filter((u) => u.id !== user?.id && u.nickname.toLowerCase().startsWith(m[1].toLowerCase())).slice(0, 6) : [];
  const pickHint = (n: string) => setText(text.replace(/@[\p{L}\p{N}_]*$/u, "@" + n + " "));

  const send = async () => {
    if (!text.trim()) return;
    const r = await fetch(CHAT_URL, { method: "POST", headers: headers(), body: JSON.stringify({ text }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(d.error || "Не отправлено");
    setText("");
    load();
  };

  const del = async (id: number | string) => {
    await fetch(CHAT_URL, { method: "POST", headers: headers(), body: JSON.stringify({ action: "delete", id }) });
    setMsgs((x) => x.filter((y) => y.id !== id));
  };

  return (
    <div className="px-4 py-10 md:px-9">
      <PageHeader title="Чат" subtitle="Общение участников. Напишите @ник, чтобы отметить человека." />
      <div className="grid gap-3.5 lg:grid-cols-[1fr_240px]">
        <div className="flex h-[65vh] flex-col rounded-2xl bg-card">
          <div ref={box} className="flex-1 space-y-3 overflow-y-auto p-4">
            {!msgs.length && <Empty text={err || "Сообщений пока нет — начните первым"} />}
            {msgs.map((x) => {
              const mine = x.userId === user?.id;
              const tagged = !!user && x.mentions.includes(user.id);
              const r = roleOf(x.role);
              return (
                <div key={x.id} className={cn("group flex items-start gap-2.5 rounded-xl p-1.5", tagged && "bg-glow/10 ring-1 ring-glow/40")}>
                  <Avatar u={db.users.find((u) => u.id === x.userId) || { id: x.userId, nickname: x.nickname, role: x.role } as never} size={34} onClick={() => openProfile(x.userId)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <button onClick={() => openProfile(x.userId)} className="font-semibold hover:underline" style={{ color: r ? `hsl(${r.color})` : undefined }}>{x.nickname}</button>
                      {r?.icon && <span title={r.name}>{r.icon}</span>}
                      <span className="text-xs text-muted-foreground">{fmtTime(x.date)}</span>
                      {(mine || can("users.manage")) && <button onClick={() => del(x.id)} className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Icon name="Trash2" size={13} /></button>}
                    </div>
                    <div className="whitespace-pre-wrap break-words"><Highlight text={x.text} myNick={user?.nickname || ""} /></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="relative border-t border-border p-3">
            {!!hints.length && (
              <div className="absolute bottom-full left-3 mb-1 w-60 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                {hints.map((h, i) => (
                  <button key={h.id} onMouseDown={(e) => { e.preventDefault(); pickHint(h.nickname); }} className={cn("block w-full px-3 py-2 text-left text-sm", i === sel ? "bg-accent" : "hover:bg-accent")}>@{h.nickname}</button>
                ))}
              </div>
            )}
            {err && msgs.length > 0 && <p className="mb-2 text-xs text-destructive">{err}</p>}
            <div className="flex gap-2">
              <input value={text} maxLength={1000} onChange={(e) => { setText(e.target.value); setSel(0); }} onKeyDown={(e) => {
                if (hints.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); setSel((s) => (s + (e.key === "ArrowDown" ? 1 : hints.length - 1)) % hints.length); return; }
                if (hints.length && (e.key === "Tab" || e.key === "Enter")) { e.preventDefault(); pickHint(hints[sel].nickname); return; }
                if (e.key === "Enter") send();
              }} placeholder="Сообщение… (@ — отметить)" className="flex-1 rounded-full bg-background px-4 py-2.5 text-base outline-none" />
              <button onClick={send} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Icon name="ArrowUp" size={18} /></button>
            </div>
          </div>
        </div>
        <div className="hidden rounded-2xl bg-card p-4 lg:block">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Участники · {users.length}</div>
          <div className="max-h-[58vh] space-y-1 overflow-y-auto">
            {users.map((u) => {
              const r = roleOf(u.role);
              return <button key={u.id} onClick={() => openProfile(u.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent"><span className="h-2 w-2 rounded-full" style={{ background: `hsl(${r?.color || "240 2% 57%"})` }} /><span className="truncate">{u.nickname}</span>{r?.icon && <span className="ml-auto">{r.icon}</span>}</button>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
