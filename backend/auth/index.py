import json
import os
import hashlib
import secrets
import psycopg2

SCHEMA = "t_p3501805_ideal_interface_proj"
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
    "Access-Control-Max-Age": "86400",
}


def resp(code: int, data: dict) -> dict:
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}


def q(s: str) -> str:
    return "'" + str(s).replace("'", "''") + "'"


def hash_pw(pw: str) -> str:
    salt = secrets.token_bytes(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 100000).hex()
    return f"pbkdf2${salt.hex()}${h}"


def check_pw(pw: str, stored: str) -> bool:
    parts = stored.split("$")
    if len(parts) != 3:
        return False
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(parts[1]), 100000).hex()
    return secrets.compare_digest(h, parts[2])


def user_row(r) -> dict:
    return {"id": f"db{r[0]}", "username": r[1], "nickname": r[2], "fullName": r[3], "role": r[4], "status": r[5], "createdAt": r[6].isoformat()}


COLS = "id, username, nickname, full_name, role, status, created_at"


def new_session(cur, user_id: int) -> str:
    token = secrets.token_hex(32)
    cur.execute(f"INSERT INTO {SCHEMA}.sessions (token, user_id, expires_at) VALUES ({q(token)}, {int(user_id)}, NOW() + INTERVAL '30 days')")
    return token


def handler(event: dict, context) -> dict:
    """Регистрация, вход, проверка сессии и выход пользователей TESTPAD STUDIO"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    token = headers.get("x-auth-token", "")
    body = json.loads(event.get("body") or "{}") if event.get("httpMethod") == "POST" else {}
    action = (event.get("queryStringParameters") or {}).get("action") or body.get("action") or "me"

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    cur = conn.cursor()
    try:
        if action == "register":
            username = (body.get("username") or "").strip()
            nickname = (body.get("nickname") or "").strip() or username
            full_name = (body.get("fullName") or "").strip()
            pw = body.get("password") or ""
            if len(username) < 3 or len(pw) < 6:
                return resp(400, {"error": "Логин от 3 символов, пароль от 6 символов"})
            cur.execute(f"SELECT 1 FROM {SCHEMA}.users WHERE LOWER(username) = LOWER({q(username)}) OR LOWER(nickname) = LOWER({q(nickname)})")
            if cur.fetchone():
                return resp(409, {"error": "Такой логин или ник уже занят"})
            cur.execute(f"INSERT INTO {SCHEMA}.users (username, nickname, full_name, role, status, password_hash) VALUES ({q(username)}, {q(nickname)}, {q(full_name)}, 'student', 'active', {q(hash_pw(pw))}) RETURNING {COLS}")
            r = cur.fetchone()
            return resp(200, {"user": user_row(r), "token": new_session(cur, r[0])})

        if action == "login":
            login = (body.get("username") or "").strip()
            pw = body.get("password") or ""
            cur.execute(f"SELECT {COLS}, password_hash FROM {SCHEMA}.users WHERE LOWER(username) = LOWER({q(login)}) OR LOWER(nickname) = LOWER({q(login)})")
            r = cur.fetchone()
            if not r or not check_pw(pw, r[7]):
                return resp(401, {"error": "Неверный логин или пароль"})
            if r[5] == "banned":
                return resp(403, {"error": "Аккаунт заблокирован"})
            return resp(200, {"user": user_row(r), "token": new_session(cur, r[0])})

        if action == "logout":
            if token:
                cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE token = {q(token)}")
            return resp(200, {"ok": True})

        if not token:
            return resp(401, {"error": "Нет сессии"})
        cur.execute(f"SELECT u.id, u.username, u.nickname, u.full_name, u.role, u.status, u.created_at FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id WHERE s.token = {q(token)} AND s.expires_at > NOW()")
        r = cur.fetchone()
        if not r:
            return resp(401, {"error": "Сессия истекла"})
        return resp(200, {"user": user_row(r)})
    finally:
        cur.close()
        conn.close()
