import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import Icon from "@/components/ui/icon";
import { useStore, fmtTime } from "@/lib/store";
import { PERMISSIONS } from "@/lib/types";
import { uid } from "@/lib/seed";
import { cn } from "@/lib/utils";
import { Pill } from "@/components/app/PageHeader";

const COLORS = ["26 51% 57%", "210 80% 62%", "146 50% 57%", "280 55% 66%", "350 70% 62%", "48 90% 58%", "180 50% 50%", "240 2% 70%"];

export function RolesPanel() {
  const { db, update, log } = useStore();
  const [name, setName] = useState("");

  const add = () => {
    if (!name.trim()) return;
    update((d) => ({ ...d, roles: [...d.roles, { id: uid("role_"), name: name.trim(), color: COLORS[d.roles.length % COLORS.length], permissions: ["tests.take"] }] }));
    log(`Создал роль «${name}»`, "users");
    setName("");
  };

  const togglePerm = (rid: string, p: string) => {
    if (rid === "dev") return;
    update((d) => ({ ...d, roles: d.roles.map((r) => (r.id === rid ? { ...r, permissions: r.permissions.includes(p as never) ? r.permissions.filter((x) => x !== p) : [...r.permissions, p as never] } : r)) }));
  };

  return (
    <div className="space-y-5">
      <div className="flex max-w-md gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Новая роль, например «Куратор»" className="rounded-full bg-card" />
        <Pill onClick={add}><Icon name="Plus" size={16} />Роль</Pill>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background px-4 py-3 text-left font-medium text-muted-foreground">Право</th>
              {db.roles.map((r) => (
                <th key={r.id} className="px-3 py-3 text-center font-medium">
                  <div className="flex flex-col items-center gap-1">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: `hsl(${r.color})` }} />{r.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">{db.users.filter((u) => u.role === r.id).length} чел.</span>
                    {!r.system && (
                      <button onClick={() => { update((d) => ({ ...d, roles: d.roles.filter((x) => x.id !== r.id), users: d.users.map((u) => (u.role === r.id ? { ...u, role: "student" } : u)) })); log(`Удалил роль «${r.name}»`, "users"); }} className="text-xs font-normal text-muted-foreground hover:text-destructive">удалить</button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-card">
                <td className="sticky left-0 bg-background px-4 py-2.5">{p.label}</td>
                {db.roles.map((r) => (
                  <td key={r.id} className="px-3 py-2.5 text-center">
                    <Checkbox checked={r.permissions.includes(p.id)} disabled={r.id === "dev"} onCheckedChange={() => togglePerm(r.id, p.id)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">У разработчика всегда полный доступ.</p>
    </div>
  );
}

export function UsersPanel() {
  const { db, user: me, update, log, roleOf } = useStore();
  const [q, setQ] = useState("");
  const list = db.users.filter((u) => (u.username + u.nickname + u.fullName).toLowerCase().includes(q.toLowerCase()));

  const setRole = (id: string, role: string) => {
    if (id === me?.id && role !== "dev") return;
    const u = db.users.find((x) => x.id === id);
    update((d) => ({ ...d, users: d.users.map((x) => (x.id === id ? { ...x, role } : x)) }));
    log(`Выдал роль «${roleOf(role)?.name}» пользователю @${u?.username}`, "users");
  };
  const setStatus = (id: string, status: "active" | "banned") => {
    const u = db.users.find((x) => x.id === id);
    update((d) => ({ ...d, users: d.users.map((x) => (x.id === id ? { ...x, status } : x)) }));
    log(`${status === "banned" ? "Заблокировал" : "Активировал"} @${u?.username}`, "users");
  };

  return (
    <div className="space-y-5">
      <div className="relative max-w-sm">
        <Icon name="Search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск пользователя" className="rounded-full bg-card pl-10" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border">
        {list.map((u, i) => {
          const r = roleOf(u.role);
          return (
            <div key={u.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-card", i && "border-t border-border")}>
              <div className="grid h-10 w-10 place-items-center rounded-full font-head text-background" style={{ background: `hsl(${r?.color || "240 2% 57%"})` }}>{u.nickname[0]}</div>
              <div className="min-w-[160px] flex-1">
                <div className="font-medium">{u.nickname} <span className="font-normal text-muted-foreground">@{u.username}</span></div>
                <div className="text-xs text-muted-foreground">{u.fullName} · с {fmtTime(u.createdAt)}</div>
              </div>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs", u.status === "active" ? "bg-ok/15 text-ok" : u.status === "pending" ? "bg-warn/15 text-warn" : "bg-destructive/15 text-destructive")}>
                {u.status === "active" ? "активен" : u.status === "pending" ? "ожидает" : "заблокирован"}
              </span>
              <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm outline-none">
                {db.roles.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              {u.id !== me?.id && (
                u.status === "active"
                  ? <button onClick={() => setStatus(u.id, "banned")} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-destructive" title="Заблокировать"><Icon name="Ban" size={15} /></button>
                  : <button onClick={() => setStatus(u.id, "active")} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-ok" title="Одобрить"><Icon name="CheckCircle2" size={15} /></button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
