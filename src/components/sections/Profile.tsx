import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Icon from "@/components/ui/icon";
import { useStore, fmtTime } from "@/lib/store";
import { PERMISSIONS } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import PageHeader, { Pill } from "@/components/app/PageHeader";

export function AuthScreen() {
  const { db, login, register } = useStore();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [u, setU] = useState("");
  const [nick, setNick] = useState("");
  const [name, setName] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!u || !p) return setErr("Заполните логин и пароль");
    if (mode === "register" && p.length < 6) return setErr("Пароль — от 6 символов");
    setBusy(true);
    const e = mode === "login" ? await login(u, p) : await register({ username: u, nickname: nick, fullName: name, password: p });
    setBusy(false);
    setErr(e || "");
  };
  const field = "rounded-xl bg-background";
  return (
    <div className="banner-glow flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-5 rounded-2xl bg-card p-7 animate-scale-in">
        <div>
          <h1 className="font-head text-3xl font-medium">{mode === "register" ? "Регистрация" : "Вход"}</h1>
          <p className="mt-1 text-muted-foreground">в {db.settings.siteName}</p>
        </div>
        <div className="space-y-2"><Label>Логин</Label><Input value={u} onChange={(e) => setU(e.target.value)} className={field} /></div>
        {mode === "register" && (
          <>
            <div className="space-y-2"><Label>Ник</Label><Input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Как вас видят другие" className={field} /></div>
            <div className="space-y-2"><Label>Имя</Label><Input value={name} onChange={(e) => setName(e.target.value)} className={field} /></div>
          </>
        )}
        <div className="space-y-2"><Label>Пароль</Label><Input type="password" value={p} onChange={(e) => setP(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className={field} /></div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Pill onClick={submit} className="w-full justify-center py-3">{busy ? "Подождите…" : mode === "register" ? "Зарегистрироваться" : "Войти"}</Pill>
        <button onClick={() => { setMode(mode === "register" ? "login" : "register"); setErr(""); }} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
          {mode === "register" ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
        </button>
      </div>
    </div>
  );
}

export default function Profile() {
  const { db, user, role, update, log, logout } = useStore();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [nick, setNick] = useState(user?.nickname || "");
  if (!user) return <AuthScreen />;

  const myResults = db.results.filter((r) => r.userId === user.id);
  const passed = myResults.filter((r) => r.passed).length;

  const save = () => {
    update((d) => ({ ...d, users: d.users.map((u) => (u.id === user.id ? { ...u, fullName, nickname: nick || u.nickname } : u)) }));
    log("Изменил профиль", "users");
    toast({ title: "Профиль сохранён" });
  };

  return (
    <div className="px-4 py-10 md:px-9">
      <PageHeader title="Личный кабинет" subtitle={`@${user.username} · с ${fmtTime(user.createdAt)}`} actions={<Pill variant="outline" onClick={logout}><Icon name="LogOut" size={14} />Выйти</Pill>} />
      <div className="grid gap-3.5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3.5">
          <div className="grid grid-cols-3 gap-3.5">
            {[{ v: myResults.length, l: "прохождений" }, { v: passed, l: "сдано" }, { v: user.groups.length, l: "групп" }].map((s) => (
              <div key={s.l} className="rounded-2xl bg-card px-5 py-4"><b className="block font-head text-[2em] font-medium">{s.v}</b><small className="text-muted-foreground">{s.l}</small></div>
            ))}
          </div>
          <div className="space-y-4 rounded-2xl bg-card p-6">
            <h3 className="font-head text-xl font-medium">Настройки профиля</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label>Имя</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="rounded-xl bg-background" /></div>
              <div className="space-y-2"><Label>Ник</Label><Input value={nick} onChange={(e) => setNick(e.target.value)} className="rounded-xl bg-background" /></div>
            </div>
            <Pill onClick={save}>Сохранить</Pill>
          </div>
        </div>
        <div className="rounded-2xl bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-full font-head text-xl text-background" style={{ background: `hsl(${role?.color})` }}>{user.nickname[0]}</div>
            <div><div className="font-head text-lg font-medium">{user.nickname}</div><div className="text-sm text-muted-foreground">{role?.name}</div></div>
          </div>
          <div className="mt-5 text-xs uppercase tracking-wider text-muted-foreground">Ваши права</div>
          <ul className="mt-2 space-y-1.5 text-sm">
            {PERMISSIONS.map((p) => {
              const on = role?.permissions.includes(p.id);
              return <li key={p.id} className={`flex items-center gap-2 ${on ? "" : "text-muted-foreground/50"}`}><Icon name={on ? "Check" : "Minus"} size={14} className={on ? "text-ok" : ""} />{p.label}</li>;
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
