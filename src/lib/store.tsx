import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { DB, LogEntry, Permission, Role, User } from "./types";
import { createSeed, uid } from "./seed";

const KEY = "testpad_studio_v7";
const TOKEN_KEY = "testpad_token";
const AUTH_URL = "https://functions.poehali.dev/52562ad2-70e3-47e9-9c50-cb97b406b2ad";

async function authCall(body: Record<string, string>) {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Auth-Token": localStorage.getItem(TOKEN_KEY) || "" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

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
  login: (username: string, password: string) => Promise<string | null>;
  register: (f: { username: string; nickname: string; fullName: string; password: string }) => Promise<string | null>;
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

  const applyUser = useCallback((u: User) => {
    setDb((d) => {
      const exists = d.users.some((x) => x.id === u.id);
      const users = exists ? d.users.map((x) => (x.id === u.id ? { ...x, ...u, groups: x.groups } : x)) : [...d.users, { ...u, groups: [] }];
      return { ...d, users, sessionUserId: u.id };
    });
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setDb((d) => ({ ...d, sessionUserId: null }));
      return;
    }
    authCall({ action: "me" }).then(({ ok, data }) => {
      if (ok && data.user) applyUser(data.user);
      else {
        localStorage.removeItem(TOKEN_KEY);
        setDb((d) => ({ ...d, sessionUserId: null }));
      }
    }).catch(() => undefined);
  }, [applyUser]);

  const finishAuth = useCallback(
    (data: { user: User; token: string }, msg: string) => {
      localStorage.setItem(TOKEN_KEY, data.token);
      applyUser(data.user);
      setTimeout(() => log(msg, "auth"), 0);
      setView("home");
    },
    [applyUser, log]
  );

  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const { ok, data } = await authCall({ action: "login", username, password });
        if (!ok) {
          log(`Неудачная попытка входа (${username})`, "auth");
          return data.error || "Не удалось войти";
        }
        finishAuth(data, "Вошёл в систему");
        return null;
      } catch {
        return "Нет связи с сервером";
      }
    },
    [log, finishAuth]
  );

  const register = useCallback(
    async (f: { username: string; nickname: string; fullName: string; password: string }) => {
      try {
        const { ok, data } = await authCall({ action: "register", ...f });
        if (!ok) return data.error || "Не удалось зарегистрироваться";
        finishAuth(data, "Зарегистрировался");
        return null;
      } catch {
        return "Нет связи с сервером";
      }
    },
    [finishAuth]
  );

  const logout = useCallback(() => {
    log("Вышел из системы", "auth");
    authCall({ action: "logout" }).catch(() => undefined);
    localStorage.removeItem(TOKEN_KEY);
    setTimeout(() => setDb((d) => ({ ...d, sessionUserId: null })), 0);
  }, [log]);

  const reset = useCallback(() => {
    setDb(createSeed());
    setView("home");
  }, []);

  const value = useMemo(
    () => ({ db, user, role, view, setView, update, log, can, roleOf, login, register, logout, reset }),
    [db, user, role, view, update, log, can, roleOf, login, register, logout, reset]
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
