export const PHP = import.meta.env.VITE_TARGET === "php";

export const AUTH_URL = PHP ? "api.php?r=auth" : "https://functions.poehali.dev/52562ad2-70e3-47e9-9c50-cb97b406b2ad";
export const CHAT_URL = PHP ? "api.php?r=chat" : "https://functions.poehali.dev/0189b12c-ce43-4ea2-a054-2f68f98dbf0d";
export const STATE_URL = "api.php?r=state";
export const SAVE_URL = "api.php?r=save";

export const withQuery = (url: string, q: string) => url + (url.includes("?") ? "&" : "?") + q;

export const authHeaders = () => ({ "Content-Type": "application/json", "X-Auth-Token": localStorage.getItem("testpad_token") || "" });

export const SYNC_COLLS = ["roles", "sections", "questions", "tests", "groups", "news", "faq", "results", "tickets", "posts", "logs"] as const;
