import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useStore } from "@/lib/store";
import PageHeader, { Pill, Empty } from "@/components/app/PageHeader";
import SectionDialog from "@/components/app/SectionDialog";

export default function CustomSection({ id }: { id: string }) {
  const { db, can } = useStore();
  const [edit, setEdit] = useState(false);
  const s = db.sections.find((x) => x.id === id);
  if (!s) return <div className="px-4 py-10 md:px-9"><Empty text="Раздел не найден" /></div>;
  const paragraphs = (s.content || "").split(/\n\s*\n/).filter(Boolean);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-9">
      <PageHeader
        title={s.title}
        subtitle={s.description}
        actions={can("sections.manage") && <Pill variant="ghost" onClick={() => setEdit(true)}><Icon name="Pencil" size={14} />Редактировать</Pill>}
      />
      {paragraphs.length ? (
        <div className="space-y-4 rounded-2xl bg-card p-7 text-[16px] leading-relaxed animate-fade-in">
          <div className="mb-2 grid h-12 w-12 place-items-center rounded-xl bg-accent"><Icon name={s.icon} fallback="FileText" size={22} /></div>
          {paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
        </div>
      ) : <Empty text="Раздел пока пуст" />}
      <SectionDialog open={edit} onOpenChange={setEdit} section={s} />
    </div>
  );
}
