import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import Icon from "@/components/ui/icon";
import { useStore } from "@/lib/store";
import { Section } from "@/lib/types";
import { Pill } from "@/components/app/PageHeader";
import SectionDialog from "@/components/app/SectionDialog";

export default function SectionsPanel() {
  const { db, update, log, roleOf } = useStore();
  const [edit, setEdit] = useState<Section | null>(null);
  const [open, setOpen] = useState(false);
  const list = [...db.sections].sort((a, b) => a.order - b.order);

  const move = (s: Section, dir: -1 | 1) => {
    const group = list.filter((x) => !!x.bottom === !!s.bottom);
    const idx = group.findIndex((x) => x.id === s.id);
    const other = group[idx + dir];
    if (!other) return;
    update((d) => ({ ...d, sections: d.sections.map((x) => (x.id === s.id ? { ...x, order: other.order } : x.id === other.id ? { ...x, order: s.order } : x)) }));
    log(`Изменил порядок раздела «${s.title}»`, "sections");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground">Название, иконка, порядок и видимость по ролям. Изменения сразу видны в меню.</p>
        <Pill onClick={() => { setEdit(null); setOpen(true); }}><Icon name="Plus" size={16} />Раздел</Pill>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border">
        {list.map((s, i) => (
          <div key={s.id} className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-card ${i ? "border-t border-border" : ""}`}>
            <div className="flex flex-col">
              <button onClick={() => move(s, -1)} className="text-muted-foreground hover:text-foreground"><Icon name="ChevronUp" size={14} /></button>
              <button onClick={() => move(s, 1)} className="text-muted-foreground hover:text-foreground"><Icon name="ChevronDown" size={14} /></button>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card"><Icon name={s.icon} fallback="FileText" size={17} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{s.title}</span>
                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-muted-foreground">{s.builtin ? "системный" : "свой"}</span>
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {s.roles.length ? s.roles.map((r) => roleOf(r)?.name || r).join(", ") : "Видят все"}
              </div>
            </div>
            <Switch
              checked={s.visible}
              disabled={s.id === "home" || s.id === "dev"}
              onCheckedChange={(v) => { update((d) => ({ ...d, sections: d.sections.map((x) => (x.id === s.id ? { ...x, visible: v } : x)) })); log(`${v ? "Показал" : "Скрыл"} раздел «${s.title}»`, "sections"); }}
            />
            <button onClick={() => { setEdit(s); setOpen(true); }} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"><Icon name="Settings2" size={15} /></button>
            <button
              disabled={s.builtin}
              onClick={() => { update((d) => ({ ...d, sections: d.sections.filter((x) => x.id !== s.id) })); log(`Удалил раздел «${s.title}»`, "sections"); }}
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-20 disabled:hover:bg-transparent"
            ><Icon name="Trash2" size={15} /></button>
          </div>
        ))}
      </div>
      <SectionDialog open={open} onOpenChange={setOpen} section={edit} />
    </div>
  );
}
