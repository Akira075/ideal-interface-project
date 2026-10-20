import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useStore, fmtTime } from "@/lib/store";
import { Role, User } from "@/lib/types";
import { cn } from "@/lib/utils";

export function compressImage(file: File, max = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}

export function ImagePicker({ onPick, multiple = true, max = 1280, children, className }: { onPick: (urls: string[]) => void; multiple?: boolean; max?: number; children?: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" multiple={multiple} hidden onChange={async (e) => {
        const files = Array.from(e.target.files || []).slice(0, 6);
        if (!files.length) return;
        setBusy(true);
        const urls = await Promise.all(files.map((f) => compressImage(f, max)));
        setBusy(false);
        onPick(urls);
        e.target.value = "";
      }} />
      <button type="button" onClick={() => ref.current?.click()} className={cn("inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground", className)}>
        {children || <><Icon name={busy ? "Loader2" : "ImagePlus"} size={15} className={busy ? "animate-spin" : ""} />Скрин</>}
      </button>
    </>
  );
}

export function Gallery({ images, onRemove, small }: { images?: string[]; onRemove?: (i: number) => void; small?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!images?.length) return null;
  return (
    <>
      <div className={cn("mt-3 grid gap-2", images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3")}>
        {images.map((src, i) => (
          <div key={i} className="group relative overflow-hidden rounded-xl bg-background">
            <img src={src} alt="" onClick={() => setOpen(src)} className={cn("w-full cursor-zoom-in object-cover", small ? "h-24" : images.length === 1 ? "max-h-[420px]" : "h-40")} />
            {onRemove && (
              <button onClick={() => onRemove(i)} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white"><Icon name="X" size={14} /></button>
            )}
          </div>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-5xl border-none bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Скриншот</DialogTitle>
          {open && <img src={open} alt="" className="max-h-[85vh] w-full rounded-xl object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function userRoles(u: User, roles: Role[]) {
  const ids = [u.role, ...(u.extraRoles || [])];
  return roles.filter((r) => ids.includes(r.id)).sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

export function RoleBadge({ r, small }: { r: Role; small?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 font-medium", small ? "py-0 text-[11px]" : "py-0.5 text-xs")} style={{ borderColor: `hsl(${r.color} / 0.5)`, background: `hsl(${r.color} / 0.12)`, color: `hsl(${r.color})` }}>
      {r.icon ? <span>{r.icon}</span> : <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${r.color})` }} />}
      {r.name}
    </span>
  );
}

export function Avatar({ u, size = 40, onClick, ring }: { u?: User | null; size?: number; onClick?: () => void; ring?: boolean }) {
  const { db } = useStore();
  const top = u ? userRoles(u, db.roles)[0] : undefined;
  const color = top?.color || "240 2% 57%";
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full font-head text-background", onClick && "cursor-pointer transition-transform hover:scale-105", ring && "ring-4 ring-background")} style={{ width: size, height: size, background: u?.avatar ? undefined : `hsl(${color})`, fontSize: size * 0.4 }}>
      {u?.avatar ? <img src={u.avatar} alt="" className="h-full w-full object-cover" /> : (u?.nickname?.[0] || "?").toUpperCase()}
    </button>
  );
}

export function daysOnSite(iso: string) {
  return Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) + 1);
}

export function ProfileCard({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { db } = useStore();
  const u = db.users.find((x) => x.id === userId);
  const roles = u ? userRoles(u, db.roles) : [];
  const res = u ? db.results.filter((r) => r.userId === u.id) : [];
  const groups = u ? db.groups.filter((g) => u.groups.includes(g.code)) : [];
  return (
    <Dialog open={!!u} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-border bg-popover p-0 sm:max-w-[440px]">
        <DialogTitle className="sr-only">Профиль</DialogTitle>
        {u && (
          <div>
            <div className="h-32 w-full bg-cover bg-center" style={{ background: u.banner ? `center/cover url(${u.banner})` : `linear-gradient(135deg, hsl(${roles[0]?.color || "240 3% 20%"}), hsl(var(--card)))` }} />
            <div className="px-5 pb-5">
              <div className="-mt-10 flex items-end justify-between">
                <Avatar u={u} size={84} ring />
                <span className={cn("mb-1 rounded-full px-2.5 py-0.5 text-xs", u.status === "active" ? "bg-ok/15 text-ok" : "bg-destructive/15 text-destructive")}>{u.status === "active" ? "активен" : u.status === "banned" ? "заблокирован" : "ожидает"}</span>
              </div>
              <div className="mt-3">
                <div className="font-head text-2xl font-medium">{u.nickname}</div>
                <div className="text-sm text-muted-foreground">{u.username ? `@${u.username}` : ""}{u.fullName ? ` · ${u.fullName}` : ""}</div>
              </div>
              {u.bio && <p className="mt-3 whitespace-pre-line text-sm">{u.bio}</p>}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[{ v: daysOnSite(u.createdAt), l: "дней на сайте" }, { v: res.length, l: "тестов" }, { v: res.filter((r) => r.passed).length, l: "сдано" }].map((s) => (
                  <div key={s.l} className="rounded-xl bg-card py-3"><b className="block font-head text-xl font-medium">{s.v}</b><small className="text-xs text-muted-foreground">{s.l}</small></div>
                ))}
              </div>
              <div className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Роли</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{roles.map((r) => <RoleBadge key={r.id} r={r} />)}</div>
              {!!u.tags?.length && (
                <>
                  <div className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Теги</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{u.tags.map((t) => <span key={t} className="rounded-full bg-accent px-2.5 py-0.5 text-xs">#{t}</span>)}</div>
                </>
              )}
              {!!groups.length && (
                <>
                  <div className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Группы</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{groups.map((g) => <span key={g.id} className="rounded-full border border-border px-2.5 py-0.5 text-xs">{g.name}</span>)}</div>
                </>
              )}
              <div className="mt-4 text-xs text-muted-foreground">На сайте с {fmtTime(u.createdAt)}</div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
