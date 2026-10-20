import json
import os
import hashlib
import secrets
import re
import psycopg2

SCHEMA = "t_p3501805_ideal_interface_proj"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
    "Access-Control-Max-Age": "86400",
}
STAFF = ("dev", "admin")
COLS = "id, username, nickname, full_name, role, status, created_at, avatar, banner, bio, tags, extra_roles, user_groups, last_seen"


def resp(code: int, data: dict) -> dict:
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}


def q(s) -> str:
    return "'" + str(s).replace("'", "''") + "'"


def lst(s: str) -> list:
    return [x for x in (s or "").split(",") if x]


def hash_pw(pw: str) -> str:
    salt = secrets.token_bytes(16)
    return f"pbkdf2${salt.hex()}${hashlib.pbkdf2_hmac('sha256', pw.encode(), salt, 100000).hex()}"


def check_pw(pw: str, stored: str) -> bool:
    p = stored.split("$")
    if len(p) != 3:
        return False
    return secrets.compare_digest(hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(p[1]), 100000).hex(), p[2])


def row_user(r, full: bool = True) -> dict:
    u = {"id": f"db{r[0]}", "username": r[1], "nickname": r[2], "fullName": r[3], "role": r[4], "status": r[5], "createdAt": r[6].isoformat(),
         "avatar": r[7], "banner": r[8], "bio": r[9], "tags": lst(r[10]), "extraRoles": lst(r[11]), "groups": lst(r[12]),
         "lastSeen": r[13].isoformat() + "Z" if r[13] else None}
    if not full:
        u["username"] = ""
    return u


def settings(cur) -> dict:
    cur.execute(f"SELECT key, value FROM {SCHEMA}.site_settings")
    d = dict(cur.fetchall())
    return {"registrationOpen": d.get("registration_open", "true") == "true", "requireApproval": d.get("require_approval", "false") == "true",
            "maintenance": d.get("maintenance", "false") == "true", "maintenanceText": d.get("maintenance_text", ""),
            "announcement": d.get("announcement", ""), "announcementType": d.get("announcement_type", "info")}


def new_session(cur, uid: int) -> str:
    t = secrets.token_hex(32)
    cur.execute(f"INSERT INTO {SCHEMA}.sessions (token, user_id, expires_at) VALUES ({q(t)}, {int(uid)}, NOW() + INTERVAL '30 days')")
    return t


def num(uid: str) -> int:
    return int(re.sub(r"\D", "", str(uid)) or 0)


def handler(event: dict, context) -> dict:
    """Пользователи: регистрация, вход, профили, список участников, онлайн и админ-управление"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    token = {k.lower(): v for k, v in (event.get("headers") or {}).items()}.get("x-auth-token", "")
    b = json.loads(event.get("body") or "{}") if event.get("httpMethod") == "POST" else {}
    action = (event.get("queryStringParameters") or {}).get("action") or b.get("action") or "me"

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    cur = conn.cursor()
    try:
        if action == "register":
            st = settings(cur)
            if not st["registrationOpen"]:
                return resp(403, {"error": "Регистрация закрыта администратором"})
            un = (b.get("username") or "").strip()
            nick = (b.get("nickname") or "").strip() or un
            pw = b.get("password") or ""
            if not re.fullmatch(r"[A-Za-z0-9_]{3,32}", un):
                return resp(400, {"error": "Логин: 3–32 символа, латиница, цифры и _"})
            if len(nick) < 3 or len(pw) < 6:
                return resp(400, {"error": "Ник от 3 символов, пароль от 6"})
            cur.execute(f"SELECT 1 FROM {SCHEMA}.users WHERE LOWER(username)=LOWER({q(un)}) OR LOWER(nickname)=LOWER({q(nick)})")
            if cur.fetchone():
                return resp(409, {"error": "Логин или ник уже занят"})
            status = "pending" if st["requireApproval"] else "active"
            cur.execute(f"INSERT INTO {SCHEMA}.users (username, nickname, full_name, role, status, password_hash) VALUES ({q(un)}, {q(nick[:32])}, {q((b.get('fullName') or '')[:100])}, 'student', {q(status)}, {q(hash_pw(pw))}) RETURNING {COLS}")
            r = cur.fetchone()
            if status == "pending":
                return resp(403, {"error": "Заявка отправлена. Дождитесь одобрения администратором."})
            return resp(200, {"user": row_user(r), "token": new_session(cur, r[0])})

        if action == "login":
            lg = (b.get("username") or "").strip()
            cur.execute(f"SELECT {COLS}, password_hash FROM {SCHEMA}.users WHERE LOWER(username)=LOWER({q(lg)}) OR LOWER(nickname)=LOWER({q(lg)})")
            r = cur.fetchone()
            if not r or not check_pw(b.get("password") or "", r[14]):
                return resp(401, {"error": "Неверный логин или пароль"})
            if r[5] == "banned":
                return resp(403, {"error": "Аккаунт заблокирован"})
            if r[5] == "pending":
                return resp(403, {"error": "Заявка ещё не одобрена администратором"})
            return resp(200, {"user": row_user(r), "token": new_session(cur, r[0])})

        if action == "logout":
            if token:
                cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE token = {q(token)}")
            return resp(200, {"ok": True})

        me = None
        if token:
            cur.execute(f"SELECT u.id, u.role FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id WHERE s.token = {q(token)} AND s.expires_at > NOW() AND u.status = 'active'")
            me = cur.fetchone()
        if not me:
            return resp(401, {"error": "Сессия истекла"})
        my_id, my_role = me
        staff = my_role in STAFF
        cur.execute(f"UPDATE {SCHEMA}.users SET last_seen = NOW() WHERE id = {my_id}")

        if action == "me":
            cur.execute(f"SELECT {COLS} FROM {SCHEMA}.users WHERE id = {my_id}")
            r = cur.fetchone()
            return resp(200, {"user": row_user(r), "settings": settings(cur)})

        if action == "users":
            cond = "" if staff else " WHERE status = 'active'"
            cur.execute(f"SELECT {COLS} FROM {SCHEMA}.users{cond} ORDER BY created_at")
            rows = cur.fetchall()
            return resp(200, {"users": [row_user(r, staff or r[0] == my_id) for r in rows], "settings": settings(cur)})

        if action == "profile":
            sets = []
            if "nickname" in b:
                nick = str(b["nickname"]).strip()[:32]
                if len(nick) < 3:
                    return resp(400, {"error": "Ник от 3 символов"})
                cur.execute(f"SELECT 1 FROM {SCHEMA}.users WHERE LOWER(nickname)=LOWER({q(nick)}) AND id <> {my_id}")
                if cur.fetchone():
                    return resp(409, {"error": "Ник уже занят"})
                sets.append(f"nickname = {q(nick)}")
            for k, col, lim in (("fullName", "full_name", 100), ("bio", "bio", 1000), ("avatar", "avatar", 400000), ("banner", "banner", 900000)):
                if k in b:
                    sets.append(f"{col} = {q(str(b[k] or '')[:lim])}")
            if "tags" in b:
                sets.append(f"tags = {q(','.join(str(t).replace(',', ' ')[:30] for t in (b['tags'] or [])[:10]))}")
            if sets:
                cur.execute(f"UPDATE {SCHEMA}.users SET {', '.join(sets)} WHERE id = {my_id}")
            cur.execute(f"SELECT {COLS} FROM {SCHEMA}.users WHERE id = {my_id}")
            return resp(200, {"user": row_user(cur.fetchone())})

        if action == "online":
            cur.execute(f"SELECT id, nickname, role, EXTRACT(EPOCH FROM NOW() - last_seen) FROM {SCHEMA}.users WHERE last_seen > NOW() - INTERVAL '40 seconds' ORDER BY last_seen DESC")
            return resp(200, {"online": [{"id": f"db{r[0]}", "nickname": r[1], "role": r[2], "ago": int(r[3] or 0)} for r in cur.fetchall()]})

        if not staff:
            return resp(403, {"error": "Недостаточно прав"})

        tid = num(b.get("id") or "")
        target = None
        if tid:
            cur.execute(f"SELECT role FROM {SCHEMA}.users WHERE id = {tid}")
            target = cur.fetchone()
        if action in ("update", "kick", "setpass") and not target:
            return resp(404, {"error": "Пользователь не найден"})
        if target and target[0] == "dev" and my_role != "dev" and tid != my_id:
            return resp(403, {"error": "Аккаунт разработчика меняет только разработчик"})

        if action == "settings":
            for k, col in (("registrationOpen", "registration_open"), ("requireApproval", "require_approval"), ("maintenance", "maintenance")):
                if k in b:
                    cur.execute(f"INSERT INTO {SCHEMA}.site_settings (key, value) VALUES ({q(col)}, {q('true' if b[k] else 'false')}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value")
            for k, col, lim in (("maintenanceText", "maintenance_text", 300), ("announcement", "announcement", 500), ("announcementType", "announcement_type", 10)):
                if k in b:
                    v = str(b[k] or "")[:lim]
                    if k == "announcementType" and v not in ("info", "ok", "warn"):
                        v = "info"
                    cur.execute(f"INSERT INTO {SCHEMA}.site_settings (key, value) VALUES ({q(col)}, {q(v)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value")
            return resp(200, {"settings": settings(cur)})

        if action == "create":
            un = (b.get("username") or "").strip()
            nick = (b.get("nickname") or "").strip() or un
            pw = b.get("password") or ""
            role = (b.get("role") or "student")[:48]
            if not re.fullmatch(r"[A-Za-z0-9_]{3,32}", un) or len(nick) < 3 or len(pw) < 6:
                return resp(400, {"error": "Логин 3–32 (латиница, цифры, _), ник от 3, пароль от 6 символов"})
            if role == "dev" and my_role != "dev":
                return resp(403, {"error": "Роль разработчика выдаёт только разработчик"})
            cur.execute(f"SELECT 1 FROM {SCHEMA}.users WHERE LOWER(username)=LOWER({q(un)}) OR LOWER(nickname)=LOWER({q(nick)})")
            if cur.fetchone():
                return resp(409, {"error": "Логин или ник уже занят"})
            cur.execute(f"INSERT INTO {SCHEMA}.users (username, nickname, full_name, role, status, password_hash) VALUES ({q(un)}, {q(nick[:32])}, {q((b.get('fullName') or '')[:100])}, {q(role)}, 'active', {q(hash_pw(pw))}) RETURNING {COLS}")
            return resp(200, {"user": row_user(cur.fetchone())})

        if action == "update":
            sets = []
            if "role" in b:
                if (b["role"] == "dev" or target[0] == "dev") and my_role != "dev":
                    return resp(403, {"error": "Роль разработчика меняет только разработчик"})
                if tid == my_id and b["role"] != my_role:
                    return resp(400, {"error": "Нельзя менять роль себе"})
                sets.append(f"role = {q(str(b['role'])[:48])}")
            if "status" in b and b["status"] in ("active", "banned", "pending"):
                if tid == my_id:
                    return resp(400, {"error": "Нельзя заблокировать себя"})
                sets.append(f"status = {q(b['status'])}")
                if b["status"] != "active":
                    cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE user_id = {tid} AND expires_at > NOW()")
            if "extraRoles" in b:
                sets.append(f"extra_roles = {q(','.join(str(x)[:48] for x in (b['extraRoles'] or [])[:20]))}")
            if "groups" in b:
                sets.append(f"user_groups = {q(','.join(str(x)[:48] for x in (b['groups'] or [])[:30]))}")
            if "tags" in b:
                sets.append(f"tags = {q(','.join(str(t).replace(',', ' ')[:30] for t in (b['tags'] or [])[:10]))}")
            for k, col in (("nickname", "nickname"), ("fullName", "full_name")):
                if k in b:
                    sets.append(f"{col} = {q(str(b[k])[:100])}")
            if sets:
                cur.execute(f"UPDATE {SCHEMA}.users SET {', '.join(sets)} WHERE id = {tid}")
            cur.execute(f"SELECT {COLS} FROM {SCHEMA}.users WHERE id = {tid}")
            return resp(200, {"user": row_user(cur.fetchone())})

        if action == "setpass":
            pw = b.get("password") or ""
            if len(pw) < 6:
                return resp(400, {"error": "Пароль от 6 символов"})
            cur.execute(f"UPDATE {SCHEMA}.users SET password_hash = {q(hash_pw(pw))} WHERE id = {tid}")
            cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE user_id = {tid} AND token <> {q(token)} AND expires_at > NOW()")
            return resp(200, {"ok": True})

        if action == "kick":
            if tid == my_id:
                return resp(400, {"error": "Нельзя выкинуть себя"})
            cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE user_id = {tid} AND expires_at > NOW()")
            cur.execute(f"UPDATE {SCHEMA}.users SET last_seen = NULL WHERE id = {tid}")
            return resp(200, {"ok": True})

        if action == "kickall":
            cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE user_id <> {my_id} AND expires_at > NOW()")
            return resp(200, {"ok": True, "n": cur.rowcount})

        return resp(400, {"error": "Неизвестное действие"})
    finally:
        cur.close()
        conn.close()
