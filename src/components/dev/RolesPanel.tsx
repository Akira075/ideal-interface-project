import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import Icon from "@/components/ui/icon";
import { useStore, fmtTime, authCall } from "@/lib/store";
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

function CreateUser({ onDone }: { onDone: () => void }) {
  const { db, adminUser } = useStore();
  const [f, setF] = useState({ username: "", nickname: "", fullName: "", password: "", role: "student" });
  const [err, setErr] = useState("");
  const submit = async () => {
    const e = await adminUser("create", f);
    if (e) return setErr(e);
    toast({ title: `Аккаунт @${f.username} создан` });
    onDone();
  };
  return (
    <div className="grid gap-2 rounded-2xl bg-card p-4 md:grid-cols-[1fr_1fr_1fr_1fr_160px_auto]">
      {(["username", "nickname", "fullName", "password"] as const).map((k) => (
        <Input key={k} value={f[k]} type={k === "password" ? "text" : "text"} placeholder={{ username: "Логин (латиница)", nickname: "Ник", fullName: "Имя", password: "Пароль от 6" }[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="h-10 rounded-xl bg-background" />
      ))}
      <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className="h-10 rounded-xl border border-border bg-background px-3 text-sm">
        {db.roles.map((r) => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
      </select>
      <Pill onClick={submit} className="justify-center">Создать</Pill>
      {err && <p className="text-sm text-destructive md:col-span-6">{err}</p>}
    </div>
  );
}

export function UsersPanel() {
  const { db, user: me, log, roleOf, openProfile, adminUser, refreshUsers } = useStore();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [st, setSt] = useState("all");
  const list = db.users.filter((u) => (st === "all" || u.status === st) && (u.username + u.nickname + u.fullName).toLowerCase().includes(q.toLowerCase()));
  const pending = db.users.filter((u) => u.status === "pending").length;

  const act = async (action: string, body: Record<string, unknown>, msg: string) => {
    const e = await adminUser(action, body);
    if (e) return toast({ title: e, variant: "destructive" });
    log(msg, "users");
    toast({ title: msg });
  };
  const isOn = (k: "registrationOpen" | "requireApproval") => (k === "registrationOpen" ? db.settings.registrationOpen !== false : !!db.settings.requireApproval);
  const toggleSetting = (k: "registrationOpen" | "requireApproval") => act("settings", { [k]: !isOn(k) }, "Настройки регистрации изменены");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-card px-5 py-4">
        {([["registrationOpen", "Регистрация открыта"], ["requireApproval", "Новые заявки одобряет администратор"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => toggleSetting(k)} className="flex items-center gap-2 text-sm">
            <Icon name={isOn(k) ? "CircleCheck" : "Circle"} size={18} className={isOn(k) ? "text-ok" : "text-muted-foreground"} />{l}
          </button>
        ))}
        <Pill onClick={() => setCreating(!creating)} className="bg-ok text-background"><Icon name="UserPlus" size={15} />Создать аккаунт</Pill>
        <button onClick={() => refreshUsers()} className="ml-auto text-sm text-muted-foreground hover:text-foreground"><Icon name="RefreshCw" size={14} className="mr-1 inline" />Обновить</button>
      </div>
      {creating && <CreateUser onDone={() => setCreating(false)} />}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Icon name="Search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск пользователя" className="rounded-full bg-card pl-10" />
        </div>
        {[["all", `Все · ${db.users.length}`], ["pending", `Заявки · ${pending}`], ["banned", "Заблокированы"]].map(([k, l]) => (
          <button key={k} onClick={() => setSt(k)} className={cn("rounded-full px-4 py-2 text-sm", st === k ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>{l}</button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border">
        {list.map((u, i) => (
          <div key={u.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-card", i && "border-t border-border")}>
            <Avatar u={u} size={40} onClick={() => openProfile(u.id)} />
            <div className="min-w-[160px] flex-1">
              <div className="font-medium">{u.nickname} <span className="font-normal text-muted-foreground">@{u.username}</span></div>
              <div className="text-xs text-muted-foreground">{u.fullName} · с {fmtTime(u.createdAt)}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {(u.extraRoles || []).map((rid) => { const x = roleOf(rid); return x ? <button key={rid} onClick={() => act("update", { id: u.id, extraRoles: (u.extraRoles || []).filter((y) => y !== rid) }, "Доп. роль снята")} title="Снять роль"><RoleBadge r={x} small /></button> : null; })}
                <select value="" onChange={(e) => e.target.value && act("update", { id: u.id, extraRoles: [...(u.extraRoles || []), e.target.value] }, "Доп. роль выдана")} className="rounded-md border border-dashed border-border bg-transparent px-1 text-[11px] text-muted-foreground outline-none">
                  <option value="">+ роль</option>
                  {db.roles.filter((x) => x.id !== u.role && !u.extraRoles?.includes(x.id)).map((x) => <option key={x.id} value={x.id}>{x.icon} {x.name}</option>)}
                </select>
              </div>
            </div>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs", u.status === "active" ? "bg-ok/15 text-ok" : u.status === "pending" ? "bg-warn/15 text-warn" : "bg-destructive/15 text-destructive")}>
              {u.status === "active" ? "активен" : u.status === "pending" ? "ожидает" : "заблокирован"}
            </span>
            <select value={u.role} disabled={u.id === me?.id} onChange={(e) => act("update", { id: u.id, role: e.target.value }, `Роль @${u.username} изменена`)} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm outline-none">
              {db.roles.map((x) => <option key={x.id} value={x.id}>{x.icon} {x.name}</option>)}
            </select>
            {u.id !== me?.id && (
              <>
                <button onClick={() => { const p = prompt(`Новый пароль для @${u.username} (от 6 символов)`); if (p) act("setpass", { id: u.id, password: p }, "Пароль изменён"); }} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground" title="Сменить пароль"><Icon name="KeyRound" size={15} /></button>
                <button onClick={() => act("kick", { id: u.id }, `@${u.username} выкинут с сайта`)} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-warn" title="Выкинуть"><Icon name="LogOut" size={15} /></button>
                {u.status === "active"
                  ? <button onClick={() => act("update", { id: u.id, status: "banned" }, `@${u.username} заблокирован`)} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-destructive" title="Заблокировать"><Icon name="Ban" size={15} /></button>
                  : <button onClick={() => act("update", { id: u.id, status: "active" }, `@${u.username} одобрен`)} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-ok" title="Одобрить / разблокировать"><Icon name="CheckCircle2" size={15} /></button>}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function OnlinePanel() {
  const { user: me, roleOf, openProfile, adminUser } = useStore();
  const [list, setList] = useState<{ id: string; nickname: string; role: string; ago: number }[]>([]);
  useEffect(() => {
    const load = () => authCall({ action: "online" }).then(({ ok, data }) => ok && setList(data.online || []));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Кто открыт на сайте прямо сейчас. Обновляется каждые 5 секунд.</p>
        <Pill variant="outline" onClick={async () => { const e = await adminUser("kickall"); toast({ title: e || "Все, кроме вас, выкинуты" }); }}>Выкинуть всех</Pill>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border">
        {list.length ? list.map((u, i) => {
          const r = roleOf(u.role);
          return (
            <div key={u.id} className={cn("flex items-center gap-3 px-4 py-3", i && "border-t border-border")}>
              <span className="h-2 w-2 rounded-full bg-ok" />
              <button onClick={() => openProfile(u.id)} className="flex-1 text-left">
                <div className="font-medium">{u.nickname}</div>
                <div className="text-xs text-muted-foreground">{r ? `${r.icon || ""} ${r.name}` : u.role} · был активен {u.ago} с назад</div>
              </button>
              {u.id !== me?.id && <Pill variant="outline" onClick={async () => { const e = await adminUser("kick", { id: u.id }); toast({ title: e || `${u.nickname} выкинут` }); setList((l) => l.filter((x) => x.id !== u.id)); }} className="text-sm">Выкинуть</Pill>}
            </div>
          );
        }) : <div className="p-6 text-center text-muted-foreground">Никого нет в сети</div>}
      </div>
    </div>
  );
}
