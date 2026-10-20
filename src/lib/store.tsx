import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { toast } from "@/hooks/use-toast";
import { DB, LogEntry, Permission, Role, User } from "./types";
import { createSeed, uid } from "./seed";
import { AUTH_URL, PHP, SAVE_URL, STATE_URL, SYNC_COLLS, authHeaders } from "./api";

const KEY = "testpad_studio_v8";
const TOKEN_KEY = "testpad_token";
type Snap = Record<string, Record<string, string>>;
const snapOf = (d: DB): Snap => {
  const o: Snap = {};
  for (const c of SYNC_COLLS) {
    o[c] = {};
    for (const it of ((d as unknown as Record<string, { id: string }[]>)[c] || [])) o[c][it.id] = JSON.stringify(it);
  }
  o.settings = { main: JSON.stringify(d.settings) };
  return o;
};

export async function authCall(body: Record<string, unknown>) {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

const NEW_SECTIONS = [
  { id: "chat", title: "Чат", icon: "MessageCircle", order: 4.7, visible: true, roles: [], builtin: true, description: "Общение участников" },
  { id: "leaderboard", title: "Рейтинг", icon: "Trophy", order: 4.5, visible: true, roles: [], builtin: true, description: "Кто прошёл больше всего тестов" },
  { id: "calls", title: "База обзвонов", icon: "Phone", order: 4.8, visible: true, roles: ["dev"], builtin: true, description: "ID прохождений, кандидаты и баллы" },
];

export function withNewSections(d: DB): DB {
  const add = NEW_SECTIONS.filter((n) => !d.sections.some((s) => s.id === n.id));
  return add.length ? { ...d, sections: [...d.sections, ...add] } : d;
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem("testpad_studio_v7");
    if (raw) return withNewSections({ ...createSeed(), ...JSON.parse(raw) });
  } catch {
    /* ignore */
  }
  return withNewSections(createSeed());
}

interface Ctx {
  db: DB;
  user: User | null;
  role: Role | null;
  view: string;
  setView: (v: string) => void;
  profileId: string | null;
  openProfile: (id: string | null) => void;
  update: (fn: (d: DB) => DB) => void;
  log: (action: string, category: LogEntry["category"]) => void;
  can: (p: Permission) => boolean;
  roleOf: (id: string) => Role | undefined;
  login: (username: string, password: string) => Promise<string | null>;
  register: (f: { username: string; nickname: string; fullName: string; password: string }) => Promise<string | null>;
  logout: () => void;
  refreshUsers: () => Promise<void>;
  saveProfile: (p: Partial<User>) => Promise<string | null>;
  adminUser: (action: string, body?: Record<string, unknown>) => Promise<string | null>;
  reset: () => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(load);
  const [view, setView] = useState("home");
  const [profileId, openProfile] = useState<string | null>(null);

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

  const sessionId = db.sessionUserId;
  const snap = useRef<Snap | null>(null);
  const saving = useRef(false);

  const pullState = useCallback(async () => {
    if (!PHP || saving.current) return;
    const r = await fetch(STATE_URL, { headers: authHeaders() }).catch(() => null);
    if (!r || !r.ok) return;
    const data = await r.json().catch(() => null);
    if (!data?.db || saving.current) return;
    setDb((d) => {
      const n = withNewSections({ ...d, ...data.db, settings: { ...d.settings, ...data.db.settings }, users: d.users, sessionUserId: d.sessionUserId });
      snap.current = snapOf(n);
      return n;
    });
  }, []);

  useEffect(() => {
    if (!PHP) return;
    pullState();
    const t = setInterval(pullState, 20000);
    return () => clearInterval(t);
  }, [pullState, sessionId]);

  useEffect(() => {
    if (!PHP || !snap.current || !sessionId) return;
    const t = setTimeout(async () => {
      const prev = snap.current;
      if (!prev) return;
      const cur = snapOf(db);
      const changes: Record<string, { up: unknown[]; del: string[] }> = {};
      for (const c of Object.keys(cur)) {
        const up = Object.keys(cur[c]).filter((id) => prev[c]?.[id] !== cur[c][id]).map((id) => JSON.parse(cur[c][id]));
        const del = Object.keys(prev[c] || {}).filter((id) => !(id in cur[c]));
        if (up.length || del.length) changes[c] = { up, del };
      }
      if (!Object.keys(changes).length) return;
      saving.current = true;
      snap.current = cur;
      const r = await fetch(SAVE_URL, { method: "POST", headers: authHeaders(), body: JSON.stringify({ changes }) }).catch(() => null);
      saving.current = false;
      if (!r || !r.ok) {
        const e = r ? (await r.json().catch(() => ({}))).error : "Нет связи с сервером";
        toast({ title: "Не сохранено на сервере", description: e || "Ошибка", variant: "destructive" });
        snap.current = prev;
        pullState();
      }
    }, 700);
    return () => clearTimeout(t);
  }, [db, sessionId, pullState]);
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

  const can = useCallback(
    (p: Permission) => {
      if (!user) return false;
      if (user.role === "dev") return true;
      const ids = [user.role, ...(user.extraRoles || [])];
      return db.roles.some((r) => ids.includes(r.id) && r.permissions.includes(p));
    },
    [user, db.roles]
  );
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
      if (ok && data.user) {
        applyUser(data.user);
        if (data.settings) setDb((d) => ({ ...d, settings: { ...d.settings, ...data.settings } }));
      }
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

  const refreshUsers = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    const { ok, data } = await authCall({ action: "users" }).catch(() => ({ ok: false, data: {} as never }));
    if (!ok || !data.users) return;
    setDb((d) => ({
      ...d,
      users: (data.users as User[]).map((u) => ({ ...u, groups: u.groups?.length ? u.groups : d.users.find((x) => x.id === u.id)?.groups || [] })),
      settings: { ...d.settings, ...data.settings },
    }));
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    refreshUsers();
    const t = setInterval(refreshUsers, 15000);
    return () => clearInterval(t);
  }, [sessionId, refreshUsers]);

  const saveProfile = useCallback(async (p: Partial<User>) => {
    setDb((d) => ({ ...d, users: d.users.map((u) => (u.id === d.sessionUserId ? { ...u, ...p } : u)) }));
    const { ok, data } = await authCall({ action: "profile", ...p });
    if (!ok) return data.error || "Не сохранено";
    applyUser(data.user);
    return null;
  }, [applyUser]);

  const adminUser = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    const { ok, data } = await authCall({ action, ...body });
    if (!ok) return data.error || "Ошибка";
    refreshUsers();
    return null;
  }, [refreshUsers]);

  const reset = useCallback(() => {
    setDb(withNewSections(createSeed()));
    setView("home");
  }, []);

  const value = useMemo(
    () => ({ db, user, role, view, setView, profileId, openProfile, update, log, can, roleOf, login, register, logout, reset, refreshUsers, saveProfile, adminUser }),
    [db, user, role, view, profileId, update, log, can, roleOf, login, register, logout, reset, refreshUsers, saveProfile, adminUser]
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