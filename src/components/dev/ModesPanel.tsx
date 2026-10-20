import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import Icon from "@/components/ui/icon";
import { useStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Pill } from "@/components/app/PageHeader";
import { AnnouncementBar } from "@/components/app/Announcement";

const TYPES = [["info", "Обновление"], ["ok", "Успех"], ["warn", "Внимание"]] as const;

export default function ModesPanel() {
  const { db, adminUser, log } = useStore();
  const s = db.settings;
  const [text, setText] = useState(s.announcement || "");
  const [type, setType] = useState<"info" | "ok" | "warn">(s.announcementType || "info");
  const [mText, setMText] = useState(s.maintenanceText || "");
  useEffect(() => { setText(s.announcement || ""); setType(s.announcementType || "info"); setMText(s.maintenanceText || ""); }, [s.announcement, s.announcementType, s.maintenanceText]);

  const save = async (body: Record<string, unknown>, msg: string) => {
    const e = await adminUser("settings", body);
    if (e) return toast({ title: e, variant: "destructive" });
    log(msg, "site");
    toast({ title: msg });
  };

  return (
    <div className="grid gap-3.5 xl:grid-cols-2">
      <div className="space-y-3 rounded-2xl bg-card p-6">
        <h3 className="font-head text-xl font-medium">Плашка сверху</h3>
        <p className="text-sm text-muted-foreground">Короткое объявление над сайтом: «Вышло обновление», «Сегодня в 22:00 работы» и т.п. Пустое поле — плашки нет.</p>
        <Textarea rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="🚀 Большое обновление!" className="rounded-xl bg-background" />
        <div className="flex flex-wrap gap-2">
          {TYPES.map(([k, l]) => (
            <button key={k} onClick={() => setType(k)} className={cn("rounded-full border px-3.5 py-1.5 text-sm", type === k ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground")}>{l}</button>
          ))}
        </div>
        {text.trim() && <div className="overflow-hidden rounded-xl"><AnnouncementBar text={text} type={type} /></div>}
        <div className="flex gap-2">
          <Pill onClick={() => save({ announcement: text.trim(), announcementType: type }, text.trim() ? "Плашка сверху обновлена" : "Плашка убрана")}>Сохранить для всех</Pill>
          {s.announcement && <Pill variant="ghost" onClick={() => { setText(""); save({ announcement: "" }, "Плашка убрана"); }}><Icon name="X" size={14} />Убрать</Pill>}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl bg-card p-6">
        <h3 className="font-head text-xl font-medium">Режимы</h3>
        <div className="flex items-center justify-between gap-4">
          <div><div className="font-medium">Технические работы</div><div className="text-sm text-muted-foreground">Пользователи остаются в аккаунте и видят сообщение о работах. Сайт открыт только разработчику</div></div>
          <Switch checked={!!s.maintenance} onCheckedChange={(v) => save({ maintenance: v }, v ? "Включены техработы" : "Техработы выключены")} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div><div className="font-medium">Одобрение регистраций</div><div className="text-sm text-muted-foreground">Новые аккаунты ждут подтверждения</div></div>
          <Switch checked={!!s.requireApproval} onCheckedChange={(v) => save({ requireApproval: v }, "Одобрение регистраций изменено")} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div><div className="font-medium">Регистрация открыта</div><div className="text-sm text-muted-foreground">Если выключить — новые люди не смогут зарегистрироваться</div></div>
          <Switch checked={s.registrationOpen !== false} onCheckedChange={(v) => save({ registrationOpen: v }, "Регистрация изменена")} />
        </div>
        <Textarea rows={2} maxLength={300} value={mText} onChange={(e) => setMText(e.target.value)} onBlur={() => mText !== (s.maintenanceText || "") && save({ maintenanceText: mText }, "Текст техработ сохранён")} placeholder="Текст для посетителей во время работ (необязательно)" className="rounded-xl bg-background" />
      </div>
    </div>
  );
}
