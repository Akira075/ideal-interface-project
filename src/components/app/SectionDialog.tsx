import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { useStore } from "@/lib/store";
import { Section } from "@/lib/types";
import { uid } from "@/lib/seed";
import { cn } from "@/lib/utils";
import { Gallery, ImagePicker } from "@/components/app/Media";

const ICONS = ["FileText", "BookOpen", "Folder", "Star", "Trophy", "Calendar", "Video", "Image", "Map", "Megaphone", "Shield", "Zap", "Heart", "Flag", "Briefcase", "GraduationCap", "Lightbulb", "Puzzle", "Rocket", "Bookmark", "Music", "Globe", "Code", "Gift"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  section?: Section | null;
}

export default function SectionDialog({ open, onOpenChange, section }: Props) {
  const { db, update, log, setView } = useStore();
  const [f, setF] = useState<Section | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr("");
    setF(
      section
        ? { ...section }
        : { id: uid("s_"), title: "", icon: "FileText", order: Math.max(...db.sections.filter((s) => !s.bottom).map((s) => s.order), 0) + 1, visible: true, roles: [], builtin: false, description: "", content: "" }
    );
  }, [open, section, db.sections]);

  if (!f) return null;
  const isNew = !section;

  const save = () => {
    if (f.title.trim().length < 2) return setErr("Название — минимум 2 символа");
    update((d) => ({
      ...d,
      sections: isNew ? [...d.sections, f] : d.sections.map((s) => (s.id === f.id ? f : s)),
    }));
    log(isNew ? `Создал раздел «${f.title}»` : `Изменил раздел «${f.title}»`, "sections");
    onOpenChange(false);
    if (isNew) setView(f.id);
  };

  const toggleRole = (id: string) =>
    setF({ ...f, roles: f.roles.includes(id) ? f.roles.filter((r) => r !== id) : [...f.roles, id] });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-border bg-popover sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="font-head text-2xl font-medium">{isNew ? "Новый раздел" : "Настройка раздела"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-[1fr_96px] gap-3">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Например, Расписание" className="rounded-xl bg-card" />
            </div>
            <div className="space-y-2">
              <Label>Порядок</Label>
              <Input type="number" value={f.order} onChange={(e) => setF({ ...f, order: Number(e.target.value) })} className="rounded-xl bg-card" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Описание</Label>
            <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Коротко о разделе" className="rounded-xl bg-card" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Подпись в меню</Label>
              <Input value={f.subtitle || ""} onChange={(e) => setF({ ...f, subtitle: e.target.value })} placeholder="Лента и анонсы" className="rounded-xl bg-card" />
            </div>
            <div className="space-y-2">
              <Label>Значок (например СКОРО)</Label>
              <Input value={f.badge || ""} onChange={(e) => setF({ ...f, badge: e.target.value })} placeholder="СКОРО / NEW" className="rounded-xl bg-card" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Иконка</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setF({ ...f, icon: ic })}
                  className={cn("grid h-10 place-items-center rounded-xl border transition-colors", f.icon === ic ? "border-foreground bg-accent" : "border-border hover:bg-card")}
                >
                  <Icon name={ic} size={16} />
                </button>
              ))}
            </div>
          </div>
          {!f.builtin && (
            <div className="space-y-2">
              <Label>Содержимое</Label>
              <Textarea rows={5} value={f.content || ""} onChange={(e) => setF({ ...f, content: e.target.value })} placeholder="Текст раздела. Пустая строка — новый абзац." className="rounded-xl bg-card" />
              <Gallery images={f.images} small onRemove={(i) => setF({ ...f, images: (f.images || []).filter((_, k) => k !== i) })} />
              <ImagePicker onPick={(u) => setF({ ...f, images: [...(f.images || []), ...u].slice(0, 12) })}><Icon name="ImagePlus" size={15} />Добавить скрины</ImagePicker>
            </div>
          )}
          <div className="space-y-2">
            <Label>Кому виден раздел</Label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setF({ ...f, roles: [] })} className={cn("rounded-full border px-3.5 py-1.5 text-sm", f.roles.length === 0 ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground")}>
                Всем
              </button>
              {db.roles.map((r) => (
                <button key={r.id} type="button" onClick={() => toggleRole(r.id)} className={cn("rounded-full border px-3.5 py-1.5 text-sm", f.roles.includes(r.id) ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground")}>
                  {r.icon} {r.name}
                </button>
              ))}
            </div>
          </div>
          {!f.builtin && (
            <div className="space-y-2">
              <Label>Кто может публиковать посты в разделе</Label>
              <div className="flex flex-wrap gap-2">
                {db.roles.map((r) => {
                  const on = (f.postRoles || []).includes(r.id);
                  return <button key={r.id} type="button" onClick={() => setF({ ...f, postRoles: on ? (f.postRoles || []).filter((x) => x !== r.id) : [...(f.postRoles || []), r.id] })} className={cn("rounded-full border px-3.5 py-1.5 text-sm", on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground")}>{r.icon} {r.name}</button>;
                })}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
            <div>
              <div className="font-medium">Показывать в меню</div>
              <div className="text-sm text-muted-foreground">Скрытый раздел видит только разработчик</div>
            </div>
            <Switch checked={f.visible} onCheckedChange={(v) => setF({ ...f, visible: v })} />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button className="rounded-full px-6" onClick={save}>{isNew ? "Создать раздел" : "Сохранить"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
