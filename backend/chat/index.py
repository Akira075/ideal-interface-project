import json
import os
import re
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


def q(s) -> str:
    return "'" + str(s).replace("'", "''") + "'"


def handler(event: dict, context) -> dict:
    """Общий чат сайта: сообщения, теги @ник, удаление"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    token = {k.lower(): v for k, v in (event.get("headers") or {}).items()}.get("x-auth-token", "")
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT u.id, u.nickname, u.role FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id WHERE s.token = {q(token)} AND s.expires_at > NOW() AND u.status = 'active'")
        me = cur.fetchone()
        if not me:
            return resp(401, {"error": "Войдите, чтобы пользоваться чатом"})
        uid, nick, role = me

        if event.get("httpMethod") == "POST":
            b = json.loads(event.get("body") or "{}")
            if b.get("action") == "delete":
                mid = int(b.get("id") or 0)
                cond = "" if role in ("dev", "admin", "moderator") else f" AND user_id = {uid}"
                cur.execute(f"UPDATE {SCHEMA}.chat_messages SET hidden = TRUE WHERE id = {mid}{cond}")
                return resp(200, {"ok": True})
            text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]", "", str(b.get("text") or "")).strip()[:1000]
            if not text:
                return resp(400, {"error": "Пустое сообщение"})
            cur.execute(f"SELECT EXTRACT(EPOCH FROM NOW() - MAX(created_at)) FROM {SCHEMA}.chat_messages WHERE user_id = {uid}")
            last = cur.fetchone()[0]
            if last is not None and float(last) < 1.2:
                return resp(429, {"error": "Слишком часто"})
            cur.execute(f"SELECT id, nickname FROM {SCHEMA}.users WHERE status = 'active' AND id <> {uid}")
            ment = []
            all_tag = role in ("dev", "admin") and re.search(r"(^|\s)@(all|все)\b", text, re.I)
            for i, n in cur.fetchall():
                if all_tag or re.search(r"(^|[^\w])@" + re.escape(n) + r"(?!\w)", text, re.I):
                    ment.append(f"db{i}")
            cur.execute(f"INSERT INTO {SCHEMA}.chat_messages (user_id, nickname, text, mentions) VALUES ({uid}, {q(nick)}, {q(text)}, {q(','.join(ment))}) RETURNING id")
            return resp(200, {"ok": True, "id": cur.fetchone()[0]})

        since = int((event.get("queryStringParameters") or {}).get("since") or 0)
        cur.execute(f"SELECT m.id, m.user_id, m.nickname, m.text, m.mentions, m.created_at, u.role FROM {SCHEMA}.chat_messages m JOIN {SCHEMA}.users u ON u.id = m.user_id WHERE m.hidden = FALSE AND m.id > {since} ORDER BY m.id DESC LIMIT 100")
        rows = cur.fetchall()
        msgs = [{"id": r[0], "userId": f"db{r[1]}", "nickname": r[2], "text": r[3], "mentions": [x for x in r[4].split(",") if x], "date": r[5].isoformat() + "Z", "role": r[6]} for r in reversed(rows)]
        cur.execute(f"SELECT id, nickname, role, created_at FROM {SCHEMA}.users WHERE status = 'active' ORDER BY nickname")
        users = [{"id": f"db{r[0]}", "nickname": r[1], "role": r[2], "createdAt": r[3].isoformat()} for r in cur.fetchall()]
        return resp(200, {"messages": msgs, "users": users, "me": f"db{uid}"})
    finally:
        cur.close()
        conn.close()
