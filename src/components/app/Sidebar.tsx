import Icon from "@/components/ui/icon";
import { useStore } from "@/lib/store";
import { Section } from "@/lib/types";
import { cn } from "@/lib/utils";

export function useVisibleSections() {
  const { db, user } = useStore();
  return db.sections
    .filter((s) => (s.visible || user?.role === "dev") && (s.roles.length === 0 || (user && s.roles.includes(user.role))))
    .sort((a, b) => a.order - b.order);
}

export function SiteLogo({ className }: { className?: string }) {
  const { db } = useStore();
  const icon = db.settings.siteIcon;
  const isImg = /^(https?:|data:)/.test(icon);
  return (
    <div className={cn("flex items-center gap-2.5 font-head font-semibold text-[15px] tracking-tight", className)}>
      <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-[10px] bg-card text-base">
        {isImg ? <img src={icon} alt="" className="h-full w-full object-cover" /> : icon}
      </span>
      <span className="truncate">{db.settings.siteName}</span>
    </div>
  );
}

function NavItem({ s, onNavigate }: { s: Section; onNavigate?: () => void }) {
  const { view, setView } = useStore();
  const on = view === s.id;
  return (
    <button
      onClick={() => {
        setView(s.id);
        onNavigate?.();
      }}
      className={cn(
        "group flex w-full items-center gap-3 rounded-[10px] px-3 py-[9px] text-left transition-colors",
        on ? "bg-card text-foreground" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
        !s.visible && "opacity-50"
      )}
    >
      <Icon name={s.icon} fallback="FileText" size={16} className={cn("shrink-0", on ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
      <span className="truncate">{s.title}</span>
      {!s.visible && <Icon name="EyeOff" size={12} className="ml-auto" />}
    </button>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const sections = useVisibleSections();
  const top = sections.filter((s) => !s.bottom);
  const bottom = sections.filter((s) => s.bottom);
  return (
    <div className="flex h-full flex-col gap-1 px-4 py-[22px]">
      <SiteLogo className="px-2 pb-[26px]" />
      {top.map((s) => (
        <NavItem key={s.id} s={s} onNavigate={onNavigate} />
      ))}
      <div className="flex-1" />
      {bottom.map((s) => (
        <NavItem key={s.id} s={s} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 overflow-y-auto border-r border-border lg:block">
      <SidebarNav />
    </aside>
  );
}