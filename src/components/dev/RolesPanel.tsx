import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import Icon from "@/components/ui/icon";
import { useStore, fmtTime } from "@/lib/store";
import { PERMISSIONS, Role } from "@/lib/types";

function hexToHsl(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
import { uid } from "@/lib/seed";
import { cn } from "@/lib/utils";
import { Pill } from "@/components/app/PageHeader";
import { Avatar, RoleBadge } from "@/components/app/Media";

const EMOJI = ["👑", "🛠️", "🛡️", "⚡", "🔥", "💎", "⭐", "🎓", "📚", "🎧", "🤖", "🧪", "💬", "🚀", "🐞", "✅"];

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

  const setRole = (rid: string, p: Partial<Role>) => update((d) => ({ ...d, roles: d.roles.map((r) => (r.id === rid ? { ...r, ...p } : r)) }));

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
      <div className="grid gap-3 md:grid-cols-2">
        {[...db.roles].sort((a, b) => (b.priority || 0) - (a.priority || 0)).map((r) => (
          <div key={r.id} className="space-y-3 rounded-2xl bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <RoleBadge r={r} />
              <span className="text-xs text-muted-foreground">{db.users.filter((u) => u.role === r.id || u.extraRoles?.includes(r.id)).length} чел.</span>
            </div>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <Input value={r.name} onChange={(e) => setRole(r.id, { name: e.target.value })} className="h-9 rounded-xl bg-background" />
              <Input type="number" title="Приоритет: чем выше, тем выше роль" value={r.priority || 0} onChange={(e) => setRole(r.id, { priority: +e.target.value })} className="h-9 rounded-xl bg-background" />
            </div>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setRole(r.id, { icon: "" })} className={cn("h-8 w-8 rounded-lg text-xs", !r.icon ? "bg-accent ring-1 ring-foreground" : "bg-background")}>—</button>
              {EMOJI.map((e) => <button key={e} onClick={() => setRole(r.id, { icon: e })} className={cn("h-8 w-8 rounded-lg", r.icon === e ? "bg-accent ring-1 ring-foreground" : "bg-background hover:bg-accent")}>{e}</button>)}
              <Input placeholder="свой" maxLength={4} value={r.icon && !EMOJI.includes(r.icon) ? r.icon : ""} onChange={(e) => setRole(r.id, { icon: e.target.value })} className="h-8 w-16 rounded-lg bg-background px-2" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {COLORS.map((c) => <button key={c} onClick={() => setRole(r.id, { color: c })} className={cn("h-6 w-6 rounded-full", r.color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-card")} style={{ background: `hsl(${c})` }} />)}
              <input type="color" title="Свой цвет" onChange={(e) => setRole(r.id, { color: hexToHsl(e.target.value) })} className="h-6 w-8 cursor-pointer rounded bg-transparent" />
              <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"><Checkbox checked={!!r.hoist} onCheckedChange={(v) => setRole(r.id, { hoist: !!v })} />Показывать отдельно</label>
            </div>
          </div>
        ))}
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
  const { db, user: me, update, log, roleOf, openProfile } = useStore();
  const [q, setQ] = useState("");
  const list = db.users.filter((u) => (u.username + u.nickname + u.fullName).toLowerCase().includes(q.toLowerCase()));

  const setRole = (id: string, role: string) => {
    if (id === me?.id && role !== "dev") return;
    const u = db.users.find((x) => x.id === id);
    update((d) => ({ ...d, users: d.users.map((x) => (x.id === id ? { ...x, role } : x)) }));
    log(`Выдал роль «${roleOf(role)?.name}» пользователю @${u?.username}`, "users");
  };
  const toggleExtra = (id: string, rid: string) => {
    update((d) => ({ ...d, users: d.users.map((x) => (x.id === id ? { ...x, extraRoles: x.extraRoles?.includes(rid) ? x.extraRoles.filter((y) => y !== rid) : [...(x.extraRoles || []), rid] } : x)) }));
    log(`Изменил доп. роли пользователя`, "users");
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
          return (
            <div key={u.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-card", i && "border-t border-border")}>
              <Avatar u={u} size={40} onClick={() => openProfile(u.id)} />
              <div className="min-w-[160px] flex-1">
                <div className="font-medium">{u.nickname} <span className="font-normal text-muted-foreground">@{u.username}</span></div>
                <div className="text-xs text-muted-foreground">{u.fullName} · с {fmtTime(u.createdAt)}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(u.extraRoles || []).map((rid) => { const x = roleOf(rid); return x ? <button key={rid} onClick={() => toggleExtra(u.id, rid)} title="Снять роль"><RoleBadge r={x} small /></button> : null; })}
                  <select value="" onChange={(e) => e.target.value && toggleExtra(u.id, e.target.value)} className="rounded-md border border-dashed border-border bg-transparent px-1 text-[11px] text-muted-foreground outline-none">
                    <option value="">+ роль</option>
                    {db.roles.filter((x) => x.id !== u.role && !u.extraRoles?.includes(x.id)).map((x) => <option key={x.id} value={x.id}>{x.icon} {x.name}</option>)}
                  </select>
                </div>
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
