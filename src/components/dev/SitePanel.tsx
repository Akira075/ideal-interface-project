import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import Icon from "@/components/ui/icon";
import { useStore } from "@/lib/store";
import { Settings } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Pill } from "@/components/app/PageHeader";

const ICONS = ["◐", "◆", "●", "▲", "✦", "✓", "★", "T", "TP", "∑"];

function readFile(file: File, cb: (url: string) => void) {
  const r = new FileReader();
  r.onload = () => cb(String(r.result));
  r.readAsDataURL(file);
}

export default function SitePanel() {
  const { db, update, log, reset } = useStore();
  const [s, setS] = useState<Settings>(db.settings);
  useEffect(() => setS(db.settings), [db.settings]);
  const isImg = /^(https?:|data:)/.test(s.siteIcon);

  const save = () => {
    update((d) => ({ ...d, settings: s }));
    log("Изменил настройки сайта (иконка, баннер)", "site");
    toast({ title: "Настройки сохранены", description: "Иконка и баннер уже обновлены." });
  };

  const backup = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: "application/json" }));
    a.download = `testpad-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    log("Скачал резервную копию", "system");
  };

  const restore = (f: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(String(r.result));
        update(() => data);
        toast({ title: "Копия восстановлена" });
        setTimeout(() => log("Восстановил резервную копию", "system"), 0);
      } catch {
        toast({ title: "Файл не подходит", variant: "destructive" });
      }
    };
    r.readAsText(f);
  };

  return (
    <div className="grid gap-3.5 xl:grid-cols-2">
      <div className="space-y-4 rounded-2xl bg-card p-6">
        <h3 className="font-head text-xl font-medium">Иконка и название</h3>
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-background text-2xl">
            {isImg ? <img src={s.siteIcon} alt="" className="h-full w-full object-cover" /> : s.siteIcon}
          </div>
          <div className="flex-1 space-y-2">
            <Label>Название сайта</Label>
            <Input value={s.siteName} onChange={(e) => setS({ ...s, siteName: e.target.value })} className="rounded-xl bg-background" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((i) => (
            <button key={i} onClick={() => setS({ ...s, siteIcon: i })} className={cn("grid h-10 min-w-10 place-items-center rounded-xl border px-2", s.siteIcon === i ? "border-foreground bg-accent" : "border-border hover:bg-background")}>{i}</button>
          ))}
          <label className="flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-border px-3 text-sm text-muted-foreground hover:text-foreground">
            <Icon name="Upload" size={14} />Загрузить
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], (u) => setS({ ...s, siteIcon: u }))} />
          </label>
        </div>
        <Input value={isImg ? s.siteIcon.slice(0, 200) : s.siteIcon} onChange={(e) => setS({ ...s, siteIcon: e.target.value })} placeholder="Символ или ссылка на картинку" className="rounded-xl bg-background" />
        <p className="text-xs text-muted-foreground">Иконка показывается во вкладке браузера и в меню.</p>
      </div>

      <div className="space-y-4 rounded-2xl bg-card p-6">
        <h3 className="font-head text-xl font-medium">Баннер главной</h3>
        <div className="space-y-2"><Label>Приглушённая часть заголовка</Label><Input value={s.bannerDim} onChange={(e) => setS({ ...s, bannerDim: e.target.value })} className="rounded-xl bg-background" /></div>
        <div className="space-y-2"><Label>Заголовок (Enter — новая строка)</Label><Textarea rows={2} value={s.bannerTitle} onChange={(e) => setS({ ...s, bannerTitle: e.target.value })} className="rounded-xl bg-background" /></div>
        <div className="space-y-2"><Label>Подзаголовок</Label><Input value={s.bannerSubtitle} onChange={(e) => setS({ ...s, bannerSubtitle: e.target.value })} className="rounded-xl bg-background" /></div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-full bg-background px-4 py-2 text-sm hover:bg-accent">
            <Icon name="ImagePlus" size={14} />Фон баннера
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], (u) => setS({ ...s, bannerImage: u }))} />
          </label>
          {s.bannerImage && <button onClick={() => setS({ ...s, bannerImage: "" })} className="text-sm text-muted-foreground hover:text-destructive">Убрать фон</button>}
        </div>
        <div className="banner-glow overflow-hidden rounded-xl border border-border px-4 py-6 text-center" style={s.bannerImage ? { backgroundImage: `linear-gradient(hsl(0 0% 0% / .6), hsl(0 0% 0% / .85)), url(${s.bannerImage})`, backgroundSize: "cover" } : undefined}>
          <div className="font-head text-lg font-medium leading-tight"><span className="text-muted-foreground">{s.bannerDim}</span> {s.bannerTitle.split("\n").map((l, i) => <span key={i}>{i > 0 && <br />}{l}</span>)}</div>
          <div className="mt-2 text-xs">{s.bannerSubtitle}</div>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl bg-card p-6">
        <h3 className="font-head text-xl font-medium">Режимы</h3>
        <div className="space-y-2 border-b border-border pb-4">
          <div>Подвал сайта</div>
          <Input value={s.footerText || ""} onChange={(e) => setS({ ...s, footerText: e.target.value })} placeholder="© 2026 GRAND-ACTIVITY • Admin Dashboard System" className="rounded-xl bg-background" />
          {(s.footerLinks || []).map((l, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_1fr_110px_1fr_40px]">
              {(["label", "title", "icon", "url"] as const).map((k) => (
                <Input key={k} value={l[k]} placeholder={{ label: "ANDROID APP", title: "Скачать APK", icon: "Smartphone", url: "https://..." }[k]} onChange={(e) => setS({ ...s, footerLinks: (s.footerLinks || []).map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })} className="h-9 rounded-lg bg-background" />
              ))}
              <button onClick={() => setS({ ...s, footerLinks: (s.footerLinks || []).filter((_, j) => j !== i) })} className="grid h-9 place-items-center rounded-lg text-muted-foreground hover:text-destructive"><Icon name="Trash2" size={14} /></button>
            </div>
          ))}
          <button onClick={() => setS({ ...s, footerLinks: [...(s.footerLinks || []), { label: "", title: "", icon: "Link", url: "" }] })} className="text-sm text-muted-foreground hover:text-foreground">+ карточка в подвал</button>
        </div>
        <div className="flex items-center justify-between gap-4"><div><div>Технические работы</div><div className="text-sm text-muted-foreground">Сайт доступен только разработчику</div></div><Switch checked={s.maintenance} onCheckedChange={(v) => setS({ ...s, maintenance: v })} /></div>
        <div className="flex items-center justify-between gap-4"><div><div>Одобрение регистраций</div><div className="text-sm text-muted-foreground">Новые аккаунты ждут подтверждения</div></div><Switch checked={s.requireApproval} onCheckedChange={(v) => setS({ ...s, requireApproval: v })} /></div>
      </div>

      <div className="space-y-4 rounded-2xl bg-card p-6">
        <h3 className="font-head text-xl font-medium">Резервные копии</h3>
        <p className="text-sm text-muted-foreground">Пользователи, тесты, вопросы, группы, новости, обращения и журнал — в одном файле.</p>
        <div className="flex flex-wrap gap-2">
          <Pill variant="ghost" onClick={backup}><Icon name="Download" size={14} />Скачать копию</Pill>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-background px-[18px] py-[9px] text-[0.95em] font-medium hover:bg-accent">
            <Icon name="Upload" size={14} />Восстановить
            <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          </label>
          <Pill variant="outline" onClick={() => { reset(); toast({ title: "Данные сброшены к демо" }); }}><Icon name="RotateCcw" size={14} />Сброс</Pill>
        </div>
      </div>

      <div className="sticky bottom-4 flex justify-end xl:col-span-2">
        <Pill onClick={save} className="px-8 py-3 shadow-2xl"><Icon name="Check" size={16} />Сохранить изменения</Pill>
      </div>
    </div>
  );
}
