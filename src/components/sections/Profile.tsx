import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Icon from "@/components/ui/icon";
import { useStore, fmtTime } from "@/lib/store";
import { PERMISSIONS } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import PageHeader, { Pill } from "@/components/app/PageHeader";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, ImagePicker, RoleBadge, daysOnSite, userRoles } from "@/components/app/Media";

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
  const { db, user, log, logout, openProfile, can, saveProfile } = useStore();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [nick, setNick] = useState(user?.nickname || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [tags, setTags] = useState((user?.tags || []).join(", "));
  if (!user) return <AuthScreen />;

  const myResults = db.results.filter((r) => r.userId === user.id);
  const passed = myResults.filter((r) => r.passed).length;
  const roles = userRoles(user, db.roles);

  const patch = async (p: Partial<typeof user>, msg: string) => {
    const e = await saveProfile(p);
    if (e) return toast({ title: e, variant: "destructive" });
    log(msg, "users");
  };
  const save = () => {
    patch({ fullName, nickname: nick || user.nickname, bio, tags: tags.split(/[,#]/).map((t) => t.trim()).filter(Boolean).slice(0, 10) }, "Изменил профиль");
    toast({ title: "Сохраняю профиль…" });
  };

  return (
    <div className="px-4 py-10 md:px-9">
      <PageHeader title="Личный кабинет" subtitle={`@${user.username} · ${daysOnSite(user.createdAt)} дн. на сайте`} actions={<><Pill variant="ghost" onClick={() => openProfile(user.id)}><Icon name="Eye" size={14} />Как видят другие</Pill><Pill variant="outline" onClick={logout}><Icon name="LogOut" size={14} />Выйти</Pill></>} />
      <div className="mb-3.5 overflow-hidden rounded-2xl bg-card">
        <div className="relative h-40 md:h-52" style={{ background: user.banner ? `center/cover url(${user.banner})` : `linear-gradient(135deg, hsl(${roles[0]?.color || "240 3% 20%"}), hsl(var(--card)))` }}>
          <div className="absolute right-3 top-3 flex gap-2">
            <ImagePicker multiple={false} max={1600} onPick={([u]) => patch({ banner: u }, "Сменил баннер профиля")} className="bg-black/60 text-white"><Icon name="Image" size={15} />Баннер</ImagePicker>
            {user.banner && <button onClick={() => patch({ banner: "" }, "Убрал баннер")} className="grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white"><Icon name="Trash2" size={14} /></button>}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4 px-6 pb-5">
          <div className="relative -mt-12">
            <Avatar u={user} size={104} ring onClick={() => openProfile(user.id)} />
            <ImagePicker multiple={false} max={400} onPick={([u]) => patch({ avatar: u }, "Сменил аватар")} className="absolute -bottom-1 -right-1 h-9 w-9 justify-center p-0 ring-4 ring-card"><Icon name="Camera" size={15} /></ImagePicker>
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="font-head text-2xl font-medium">{user.nickname}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">{roles.map((r) => <RoleBadge key={r.id} r={r} />)}</div>
          </div>
        </div>
      </div>
      <div className="grid gap-3.5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {[{ v: daysOnSite(user.createdAt), l: "дней на сайте" }, { v: myResults.length, l: "прохождений" }, { v: passed, l: "сдано" }, { v: user.groups.length, l: "групп" }].map((s) => (
              <div key={s.l} className="rounded-2xl bg-card px-5 py-4"><b className="block font-head text-[2em] font-medium">{s.v}</b><small className="text-muted-foreground">{s.l}</small></div>
            ))}
          </div>
          <div className="space-y-4 rounded-2xl bg-card p-6">
            <h3 className="font-head text-xl font-medium">Настройки профиля</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label>Имя</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="rounded-xl bg-background" /></div>
              <div className="space-y-2"><Label>Ник</Label><Input value={nick} onChange={(e) => setNick(e.target.value)} className="rounded-xl bg-background" /></div>
            </div>
            <div className="space-y-2"><Label>О себе</Label><Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Пара слов о себе" className="rounded-xl bg-background" /></div>
            <div className="space-y-2"><Label>Теги (через запятую)</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="админ, куратор, ночная смена" className="rounded-xl bg-background" /></div>
            <Pill onClick={save}>Сохранить</Pill>
          </div>
          {!!myResults.length && (
            <div className="rounded-2xl bg-card p-6">
              <h3 className="mb-3 font-head text-xl font-medium">Мои результаты</h3>
              <div className="space-y-2">
                {myResults.slice(0, 8).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-background px-4 py-2.5 text-sm">
                    <span className="truncate">{db.tests.find((t) => t.id === r.testId)?.title || "Тест"}</span>
                    <span className={r.passed ? "text-ok" : "text-destructive"}>{r.score}% · {fmtTime(r.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-card p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Ваши права</div>
          <ul className="mt-2 space-y-1.5 text-sm">
            {PERMISSIONS.map((p) => {
              const on = can(p.id);
              return <li key={p.id} className={`flex items-center gap-2 ${on ? "" : "text-muted-foreground/50"}`}><Icon name={on ? "Check" : "Minus"} size={14} className={on ? "text-ok" : ""} />{p.label}</li>;
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
