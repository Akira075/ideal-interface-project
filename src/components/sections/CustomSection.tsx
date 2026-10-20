import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Textarea } from "@/components/ui/textarea";
import { useStore, fmtTime } from "@/lib/store";
import { uid } from "@/lib/seed";
import PageHeader, { Pill, Empty } from "@/components/app/PageHeader";
import SectionDialog from "@/components/app/SectionDialog";
import { Avatar, Gallery, ImagePicker } from "@/components/app/Media";

export default function CustomSection({ id }: { id: string }) {
  const { db, user, can, update, log, openProfile } = useStore();
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState("");
  const [imgs, setImgs] = useState<string[]>([]);
  const s = db.sections.find((x) => x.id === id);
  if (!s) return <div className="px-4 py-10 md:px-9"><Empty text="Раздел не найден" /></div>;
  const paragraphs = (s.content || "").split(/\n\s*\n/).filter(Boolean);
  const posts = (db.posts || []).filter((p) => p.sectionId === s.id);
  const myRoles = user ? [user.role, ...(user.extraRoles || [])] : [];
  const canPost = !!user && (can("sections.manage") || (s.postRoles || []).some((r) => myRoles.includes(r)));

  const publish = () => {
    if (!user || (!text.trim() && !imgs.length)) return;
    update((d) => ({ ...d, posts: [{ id: uid("p"), sectionId: s.id, userId: user.id, text, images: imgs, date: new Date().toISOString() }, ...(d.posts || [])] }));
    log(`Опубликовал пост в разделе «${s.title}»`, "content");
    setText(""); setImgs([]);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-9">
      <PageHeader title={s.title} subtitle={s.description} actions={can("sections.manage") && <Pill variant="ghost" onClick={() => setEdit(true)}><Icon name="Pencil" size={14} />Редактировать</Pill>} />
      {paragraphs.length || s.images?.length ? (
        <div className="space-y-4 rounded-2xl bg-card p-7 text-[16px] leading-relaxed animate-fade-in">
          <div className="mb-2 grid h-12 w-12 place-items-center rounded-xl bg-accent"><Icon name={s.icon} fallback="FileText" size={22} /></div>
          {paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
          <Gallery images={s.images} />
        </div>
      ) : !posts.length && !canPost && <Empty text="Раздел пока пуст" />}
      {canPost && (
        <div className="mt-4 space-y-3 rounded-2xl bg-card p-5">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Написать пост в раздел" className="rounded-xl bg-background" />
          <Gallery images={imgs} small onRemove={(i) => setImgs(imgs.filter((_, k) => k !== i))} />
          <div className="flex justify-between gap-2"><ImagePicker onPick={(u) => setImgs([...imgs, ...u].slice(0, 6))} /><Pill onClick={publish}>Опубликовать</Pill></div>
        </div>
      )}
      <div className="mt-4 space-y-3">
        {posts.map((p) => {
          const a = db.users.find((u) => u.id === p.userId);
          return (
            <article key={p.id} className="rounded-2xl bg-card p-5 animate-fade-in">
              <div className="mb-2 flex items-center gap-3">
                <Avatar u={a} size={36} onClick={() => openProfile(p.userId)} />
                <div className="flex-1 leading-tight"><div className="font-medium">{a?.nickname || "Участник"}</div><div className="text-xs text-muted-foreground">{fmtTime(p.date)}</div></div>
                {(p.userId === user?.id || can("sections.manage")) && <button onClick={() => update((d) => ({ ...d, posts: (d.posts || []).filter((x) => x.id !== p.id) }))} className="text-muted-foreground hover:text-destructive"><Icon name="Trash2" size={15} /></button>}
              </div>
              <p className="whitespace-pre-line">{p.text}</p>
              <Gallery images={p.images} />
            </article>
          );
        })}
      </div>
      <SectionDialog open={edit} onOpenChange={setEdit} section={s} />
    </div>
  );
}
