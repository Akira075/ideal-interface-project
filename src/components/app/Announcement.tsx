import Icon from "@/components/ui/icon";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const STYLE = {
  info: { cls: "bg-ok/15 text-foreground", icon: "Megaphone", ic: "text-ok" },
  ok: { cls: "bg-ok/25 text-foreground", icon: "CircleCheck", ic: "text-ok" },
  warn: { cls: "bg-warn/20 text-foreground", icon: "TriangleAlert", ic: "text-warn" },
};

export function AnnouncementBar({ text, type = "info" }: { text: string; type?: "info" | "ok" | "warn" }) {
  const st = STYLE[type] || STYLE.info;
  return (
    <div className={cn("flex items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-medium", st.cls)}>
      <Icon name={st.icon} size={15} className={cn("shrink-0", st.ic)} />
      <span>{text}</span>
    </div>
  );
}

export default function Announcement() {
  const { db } = useStore();
  const t = (db.settings.announcement || "").trim();
  if (!t) return null;
  return <AnnouncementBar text={t} type={db.settings.announcementType} />;
}
