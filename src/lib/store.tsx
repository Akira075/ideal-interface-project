import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { DB, LogEntry, Permission, Role, User } from "./types";
import { createSeed, uid } from "./seed";

const KEY = "testpad_studio_v6";

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...createSeed(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return createSeed();
}

interface Ctx {
  db: DB;
  user: User | null;
  role: Role | null;
  view: string;
  setView: (v: string) => void;
  update: (fn: (d: DB) => DB) => void;
  log: (action: string, category: LogEntry["category"]) => void;
  can: (p: Permission) => boolean;
  roleOf: (id: string) => Role | undefined;
  login: (username: string, password: string) => string | null;
  logout: () => void;
  reset: () => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(load);
  const [view, setView] = useState("home");

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(db));
  }, [db]);

  useEffect(() => {
    const icon = db.settings.siteIcon;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    if (/^(https?:|data:)/.test(icon)) {
      link.href = icon;
      link.type = "";
    } else {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='24' fill='black'/><text x='50' y='68' font-size='58' text-anchor='middle' fill='white'>${icon}</text></svg>`;
      link.href = "data:image/svg+xml," + encodeURIComponent(svg);
      link.type = "image/svg+xml";
    }
    document.title = db.settings.siteName;
  }, [db.settings.siteIcon, db.settings.siteName]);

  const user = db.users.find((u) => u.id === db.sessionUserId) || null;
  const role = user ? db.roles.find((r) => r.id === user.role) || null : null;

  const update = useCallback((fn: (d: DB) => DB) => setDb((d) => fn(d)), []);

  const log = useCallback(
    (action: string, category: LogEntry["category"]) =>
      setDb((d) => {
        const u = d.users.find((x) => x.id === d.sessionUserId);
        const entry: LogEntry = {
          id: uid("l"),
          time: new Date().toISOString(),
          user: u ? u.nickname : "Гость",
          role: u ? u.role : "guest",
          action,
          category,
        };
        return { ...d, logs: [entry, ...d.logs].slice(0, 1000) };
      }),
    []
  );

  const can = useCallback((p: Permission) => !!role && role.permissions.includes(p), [role]);
  const roleOf = useCallback((id: string) => db.roles.find((r) => r.id === id), [db.roles]);

  const login = useCallback(
    (username: string, password: string) => {
      const u = db.users.find(
        (x) => (x.username.toLowerCase() === username.toLowerCase() || x.nickname.toLowerCase() === username.toLowerCase())
      );
      if (!u || u.password !== password) {
        log(`Неудачная попытка входа (${username})`, "auth");
        return "Неверный логин или пароль";
      }
      if (u.status === "banned") return "Аккаунт заблокирован";
      if (u.status === "pending") return "Аккаунт ожидает одобрения";
      setDb((d) => ({ ...d, sessionUserId: u.id }));
      setTimeout(() => log("Вошёл в систему", "auth"), 0);
      setView("home");
      return null;
    },
    [db.users, log]
  );

  const logout = useCallback(() => {
    log("Вышел из системы", "auth");
    setTimeout(() => setDb((d) => ({ ...d, sessionUserId: null })), 0);
  }, [log]);

  const reset = useCallback(() => {
    setDb(createSeed());
    setView("home");
  }, []);

  const value = useMemo(
    () => ({ db, user, role, view, setView, update, log, can, roleOf, login, logout, reset }),
    [db, user, role, view, update, log, can, roleOf, login, logout, reset]
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
