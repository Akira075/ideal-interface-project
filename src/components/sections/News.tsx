import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Icon from "@/components/ui/icon";
import { useStore, fmtTime } from "@/lib/store";
import { uid } from "@/lib/seed";
import PageHeader, { Pill, Empty } from "@/components/app/PageHeader";
import { Gallery, ImagePicker } from "@/components/app/Media";

export default function News() {
  const { db, user, can, update, log } = useStore();
  const manage = can("news.manage");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [imgs, setImgs] = useState<string[]>([]);
  const list = [...db.news].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date));

  const publish = () => {
    if (!title.trim() || (!text.trim() && !imgs.length)) return;
    update((d) => ({ ...d, news: [{ id: uid("n"), title, text, author: user?.nickname || "", date: new Date().toISOString(), pinned: false, images: imgs }, ...d.news] }));
    log(`Опубликовал новость «${title}»`, "content");
    setTitle(""); setText(""); setImgs([]); setOpen(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-9">
      <PageHeader title="Новости" subtitle="Что нового на платформе." actions={manage && <Pill onClick={() => setOpen(!open)}><Icon name="PenLine" size={16} />Написать</Pill>} />
      {open && (
        <div className="mb-6 space-y-3 rounded-2xl bg-card p-5 animate-fade-in">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок" className="rounded-xl bg-background" />
          <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Текст новости" className="rounded-xl bg-background" />
          <Gallery images={imgs} small onRemove={(i) => setImgs(imgs.filter((_, k) => k !== i))} />
          <div className="flex items-center justify-between gap-2"><ImagePicker onPick={(u) => setImgs([...imgs, ...u].slice(0, 6))} /><Pill onClick={publish}>Опубликовать</Pill></div>
        </div>
      )}
      {list.length ? (
        <div className="space-y-3.5">
          {list.map((n) => (
            <article key={n.id} className="rounded-2xl bg-card p-6 animate-fade-in">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                {n.pinned && <span className="flex items-center gap-1 rounded-full bg-glow/15 px-2 py-0.5 text-glow"><Icon name="Pin" size={11} />Закреплено</span>}
                <span>{n.author}</span><span>·</span><span>{fmtTime(n.date)}</span>
              </div>
              <h3 className="font-head text-[1.5em] font-medium">{n.title}</h3>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">{n.text}</p>
              <Gallery images={n.images} />
              {manage && (
                <div className="mt-4 flex gap-3 text-sm">
                  <button onClick={() => update((d) => ({ ...d, news: d.news.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x)) }))} className="text-muted-foreground hover:text-foreground">{n.pinned ? "Открепить" : "Закрепить"}</button>
                  <button onClick={() => { update((d) => ({ ...d, news: d.news.filter((x) => x.id !== n.id) })); log(`Удалил новость «${n.title}»`, "content"); }} className="text-muted-foreground hover:text-destructive">Удалить</button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : <Empty text="Новостей пока нет" />}
    </div>
  );
}
