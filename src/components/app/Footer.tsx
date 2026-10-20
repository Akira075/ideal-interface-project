import Icon from "@/components/ui/icon";
import { useStore } from "@/lib/store";

const DEFAULT_LINKS = [
  { label: "ANDROID APP", title: "Скачать APK", icon: "Smartphone", url: "" },
  { label: "FRONT & BACK DEV", title: "Vitaliy Bianchi", icon: "Code", url: "" },
  { label: "BACKEND DEV", title: "Akira Simidzu", icon: "Database", url: "" },
];
const TONES = ["210 80% 62%", "260 70% 68%", "146 50% 52%", "26 80% 60%"];

export default function Footer() {
  const { db } = useStore();
  const links = db.settings.footerLinks?.length ? db.settings.footerLinks : DEFAULT_LINKS;
  const text = db.settings.footerText || `© ${new Date().getFullYear()} GRAND-ACTIVITY • Admin Dashboard System`;
  const [left, right] = text.split("•");
  return (
    <footer className="mx-4 mt-10 flex flex-col gap-4 border-t border-border py-6 md:mx-9 lg:flex-row lg:items-center lg:justify-between">
      <div className="text-sm text-muted-foreground">
        <span className="text-foreground/80">{left.trim()}</span>
        {right && <><span className="mx-2">•</span><span>{right.trim()}</span></>}
      </div>
      <div className="flex flex-wrap gap-2.5">
        {links.map((l, i) => {
          const tone = TONES[i % TONES.length];
          const Inner = (
            <>
              <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `hsl(${tone} / 0.15)`, color: `hsl(${tone})` }}><Icon name={l.icon} fallback="Link" size={14} /></span>
              <span className="leading-tight">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{l.label}</span>
                <span className="block text-[13px] font-semibold">{l.title}</span>
              </span>
            </>
          );
          const cls = "flex items-center gap-2.5 rounded-xl border border-border bg-card/60 px-3 py-2 transition-colors hover:bg-card";
          return l.url ? <a key={i} href={l.url} target="_blank" rel="noreferrer" className={cls}>{Inner}</a> : <div key={i} className={cls}>{Inner}</div>;
        })}
      </div>
    </footer>
  );
}
