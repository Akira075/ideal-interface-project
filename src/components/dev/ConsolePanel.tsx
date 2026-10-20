import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/seed";
import { DB } from "@/lib/types";

const HELP = `Команды (текст с пробелами — в "кавычках"):
  help                               — справка
  stats                              — сводка
  users                              — список пользователей
  role <ник> <id роли>               — основная роль
  addrole <ник> <id роли>            — доп. роль (как в Discord)
  delrole <ник> <id роли>            — снять доп. роль
  roles                              — список ролей
  newrole "Название" [значок] [цвет] — создать роль
  roleicon <id роли> <значок>        — значок роли
  ban <ник> / unban <ник>            — блокировка
  tag <ник> "тег"                    — добавить тег пользователю
  news "Заголовок" "Текст"           — новость
  section add "Название" "Текст"     — новый раздел
  section hide|show "Название"       — скрыть/показать
  section badge "Название" "СКОРО"   — значок раздела (off — убрать)
  section roles "Название" id1,id2   — кому виден (all — всем)
  section post "Название" id1,id2    — кто может публиковать
  test lock|unlock "Название"        — блокировка теста
  test roles "Название" id1,id2      — роли теста (all — всем)
  faq add "Вопрос" "Ответ"           — в FAQ
  maint on|off                       — техработы
  set siteName "Имя"                 — название сайта
  footer "© 2026 ИМЯ • Подпись"      — текст подвала
  clearlogs                          — очистить журнал
  clear                              — очистить экран`;

function tokenize(s: string) {
  return Array.from(s.matchAll(/"([^"]*)"|(\S+)/g)).map((m) => m[1] ?? m[2]);
}

export default function ConsolePanel() {
  const { db, update, log } = useStore();
  const [lines, setLines] = useState<string[]>(["Консоль управления сайтом. Введите help"]);
  const [cmd, setCmd] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  const run = (raw: string) => {
    const a = tokenize(raw.trim());
    const c = (a.shift() || "").toLowerCase();
    const findU = (n?: string) => db.users.find((u) => [u.username, u.nickname].some((x) => x.toLowerCase() === (n || "").replace("@", "").toLowerCase()));
    const findS = (n?: string) => db.sections.find((s) => s.title.toLowerCase() === (n || "").toLowerCase() || s.id === n);
    const findT = (n?: string) => db.tests.find((t) => t.title.toLowerCase() === (n || "").toLowerCase() || t.id === n);
    const ids = (v?: string) => (!v || v === "all" ? [] : v.split(",").map((x) => x.trim()).filter(Boolean));
    const apply = (fn: (d: DB) => DB, msg: string) => { update(fn); log(`[консоль] ${raw}`, "system"); return msg; };
    const patchU = (id: string, p: Record<string, unknown>) => (d: DB) => ({ ...d, users: d.users.map((u) => (u.id === id ? { ...u, ...p } : u)) });

    switch (c) {
      case "": return "";
      case "help": return HELP;
      case "clear": setLines([]); return null;
      case "stats": return `пользователей: ${db.users.length}\nролей: ${db.roles.length}\nразделов: ${db.sections.length}\nтестов: ${db.tests.length}\nвопросов: ${db.questions.length}\nрезультатов: ${db.results.length}\nновостей: ${db.news.length}\nтехработы: ${db.settings.maintenance ? "вкл" : "выкл"}`;
      case "users": return db.users.map((u) => `@${u.username} [${u.nickname}] ${u.role}${u.extraRoles?.length ? " +" + u.extraRoles.join(",") : ""} ${u.status}`).join("\n");
      case "roles": return db.roles.map((r) => `${r.id} — ${r.icon || ""} ${r.name} (прав: ${r.permissions.length})`).join("\n");
      case "role": case "addrole": case "delrole": {
        const u = findU(a[0]); const r = db.roles.find((x) => x.id === a[1]);
        if (!u) return "Пользователь не найден";
        if (!r) return "Роль не найдена. Список: roles";
        if (c === "role") return apply(patchU(u.id, { role: r.id }), `@${u.username} теперь «${r.name}»`);
        const ex = u.extraRoles || [];
        return apply(patchU(u.id, { extraRoles: c === "addrole" ? Array.from(new Set([...ex, r.id])) : ex.filter((x) => x !== r.id) }), "Готово");
      }
      case "newrole": {
        if (!a[0]) return 'newrole "Название" [значок] [цвет hsl]';
        const id = uid("role_");
        return apply((d) => ({ ...d, roles: [...d.roles, { id, name: a[0], icon: a[1] || "", color: a.slice(2).join(" ") || "210 80% 62%", permissions: ["tests.take"], priority: 1 }] }), `Роль создана, id: ${id}`);
      }
      case "roleicon": return apply((d) => ({ ...d, roles: d.roles.map((r) => (r.id === a[0] ? { ...r, icon: a[1] || "" } : r)) }), "Значок обновлён");
      case "ban": case "unban": {
        const u = findU(a[0]); if (!u) return "Пользователь не найден";
        return apply(patchU(u.id, { status: c === "ban" ? "banned" : "active" }), "Готово");
      }
      case "tag": {
        const u = findU(a[0]); if (!u || !a[1]) return 'tag <ник> "тег"';
        return apply(patchU(u.id, { tags: Array.from(new Set([...(u.tags || []), a[1]])) }), "Тег добавлен");
      }
      case "news":
        if (!a[0] || !a[1]) return 'news "Заголовок" "Текст"';
        return apply((d) => ({ ...d, news: [{ id: uid("n"), title: a[0], text: a[1], author: "Консоль", date: new Date().toISOString(), pinned: false }, ...d.news] }), "Новость опубликована");
      case "section": {
        const sub = a[0];
        if (sub === "add") {
          if (!a[1]) return 'section add "Название" "Текст"';
          const order = Math.max(...db.sections.filter((s) => !s.bottom).map((s) => s.order), 0) + 1;
          return apply((d) => ({ ...d, sections: [...d.sections, { id: uid("s_"), title: a[1], icon: "BookOpen", order, visible: true, roles: [], builtin: false, description: "", content: a[2] || "" }] }), "Раздел добавлен");
        }
        const s = findS(a[1]); if (!s) return "Раздел не найден";
        const set = (p: Record<string, unknown>) => apply((d) => ({ ...d, sections: d.sections.map((x) => (x.id === s.id ? { ...x, ...p } : x)) }), "Готово");
        if (sub === "hide" || sub === "show") return s.id === "dev" ? "Панель скрыть нельзя" : set({ visible: sub === "show" });
        if (sub === "badge") return set({ badge: a[2] === "off" ? "" : a[2] || "" });
        if (sub === "roles") return set({ roles: ids(a[2]) });
        if (sub === "post") return set({ postRoles: ids(a[2]) });
        return "section add|hide|show|badge|roles|post";
      }
      case "test": {
        const t = findT(a[1]); if (!t) return "Тест не найден";
        const set = (p: Record<string, unknown>) => apply((d) => ({ ...d, tests: d.tests.map((x) => (x.id === t.id ? { ...x, ...p } : x)) }), "Готово");
        if (a[0] === "lock" || a[0] === "unlock") return set({ isBlocked: a[0] === "lock" });
        if (a[0] === "roles") return set({ roles: ids(a[2]) });
        return "test lock|unlock|roles";
      }
      case "faq":
        if (a[0] !== "add" || !a[1] || !a[2]) return 'faq add "Вопрос" "Ответ"';
        return apply((d) => ({ ...d, faq: [...d.faq, { id: uid("f"), q: a[1], a: a[2] }] }), "Добавлено в FAQ");
      case "maint": return apply((d) => ({ ...d, settings: { ...d.settings, maintenance: ["on", "1", "да"].includes(a[0]) } }), "Режим техработ обновлён");
      case "set":
        if (a[0] !== "siteName" || !a[1]) return 'set siteName "Имя"';
        return apply((d) => ({ ...d, settings: { ...d.settings, siteName: a[1] } }), "Название обновлено");
      case "footer": return apply((d) => ({ ...d, settings: { ...d.settings, footerText: a[0] || "" } }), "Подвал обновлён");
      case "clearlogs": return apply((d) => ({ ...d, logs: [] }), "Журнал очищен");
      default: return `Неизвестная команда «${c}». Введите help`;
    }
  };

  const submit = () => {
    const out = run(cmd);
    if (out !== null) setLines((l) => [...l, `> ${cmd}`, ...(out ? [out] : [])]);
    if (cmd.trim()) setHist((h) => [cmd, ...h].slice(0, 50));
    setCmd(""); setHi(-1);
    setTimeout(() => box.current?.scrollTo(0, box.current.scrollHeight), 0);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-black">
      <div ref={box} className="h-[420px] overflow-y-auto whitespace-pre-wrap p-4 font-mono text-[13px] leading-relaxed text-green-300">
        {lines.map((l, i) => <div key={i} className={l.startsWith(">") ? "text-white" : ""}>{l}</div>)}
      </div>
      <div className="flex items-center gap-2 border-t border-border p-2">
        <span className="pl-2 font-mono text-green-400">$</span>
        <Input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "ArrowUp" && hist[hi + 1] !== undefined) { setHi(hi + 1); setCmd(hist[hi + 1]); }
          if (e.key === "ArrowDown") { const n = hi - 1; setHi(n); setCmd(n >= 0 ? hist[n] : ""); }
        }} placeholder="help" className="border-none bg-transparent font-mono text-white focus-visible:ring-0" autoFocus />
      </div>
    </div>
  );
}
