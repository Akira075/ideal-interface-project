import { ReactNode } from "react";

export default function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-in">
      <div>
        <h1 className="font-head text-[34px] font-medium leading-[1.1] tracking-[-0.025em] md:text-[44px]">{title}</h1>
        {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Pill({ children, onClick, variant = "white", className = "" }: { children: ReactNode; onClick?: () => void; variant?: "white" | "ghost" | "outline"; className?: string }) {
  const v =
    variant === "white"
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : variant === "ghost"
      ? "bg-card text-foreground hover:bg-accent"
      : "hairline bg-transparent text-foreground hover:bg-card";
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-2 rounded-full px-[18px] py-[9px] text-[0.95em] font-medium transition-all ${v} ${className}`}>
      {children}
    </button>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">{text}</div>;
}
