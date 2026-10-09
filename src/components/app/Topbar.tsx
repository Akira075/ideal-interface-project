import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Icon from "@/components/ui/icon";
import { useStore } from "@/lib/store";
import { SidebarNav } from "./Sidebar";
import SectionDialog from "./SectionDialog";

export default function Topbar() {
  const { db, view, setView, user, role, can, logout } = useStore();
  const [menu, setMenu] = useState(false);
  const [newSec, setNewSec] = useState(false);
  const current = db.sections.find((s) => s.id === view);

  return (
    <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-9">
      <div className="flex min-w-0 items-center gap-3">
        <button className="grid h-9 w-9 place-items-center rounded-full bg-card lg:hidden" onClick={() => setMenu(true)} aria-label="Меню">
          <Icon name="Menu" size={18} />
        </button>
        <span className="truncate text-muted-foreground">{current?.title || "Обзор"}</span>
      </div>
      <div className="flex items-center gap-2">
        {can("sections.manage") && (
          <button onClick={() => setNewSec(true)} className="hidden rounded-full bg-primary px-[18px] py-[9px] text-[0.95em] font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:inline-flex">
            Новый раздел
          </button>
        )}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full bg-card px-[18px] py-[9px] text-[0.95em] font-medium transition-colors hover:bg-accent">
                <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${role?.color})` }} />
                {role?.name || "Гость"}
                <Icon name="ChevronDown" size={14} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl border-border bg-popover">
              <DropdownMenuLabel className="font-normal">
                <div className="font-medium">{user.nickname}</div>
                <div className="text-xs text-muted-foreground">@{user.username}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setView("profile")}><Icon name="CircleUser" size={14} className="mr-2" />Личный кабинет</DropdownMenuItem>
              {user.role === "dev" && <DropdownMenuItem onClick={() => setView("dev")}><Icon name="Settings2" size={14} className="mr-2" />Панель разработчика</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive"><Icon name="LogOut" size={14} className="mr-2" />Выйти</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button onClick={() => setView("profile")} className="rounded-full bg-card px-[18px] py-[9px] text-[0.95em] font-medium">Войти</button>
        )}
      </div>

      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-[260px] border-border bg-background p-0">
          <SheetTitle className="sr-only">Меню разделов</SheetTitle>
          <SidebarNav onNavigate={() => setMenu(false)} />
        </SheetContent>
      </Sheet>
      <SectionDialog open={newSec} onOpenChange={setNewSec} />
    </header>
  );
}
