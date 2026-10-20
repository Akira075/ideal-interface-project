import { useState } from "react";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/seed";
import PageHeader, { Pill, Empty } from "@/components/app/PageHeader";

export default function Groups() {
  const { db, user, can, update, log, adminUser } = useStore();
  const manage = can("groups.manage");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [adding, setAdding] = useState(false);
  const groups = manage ? db.groups : db.groups.filter((g) => user?.groups.includes(g.code));

  const add = () => {
    if (!name.trim() || !code.trim() || db.groups.some((g) => g.code === code.trim())) return;
    update((d) => ({ ...d, groups: [...d.groups, { id: uid("g"), name: name.trim(), code: code.trim(), description: "" }] }));
    log(`Создал группу «${name}»`, "users");
    setName(""); setCode(""); setAdding(false);
  };

  const toggleMember = (uidv: string, gcode: string) => {
    const u0 = db.users.find((u) => u.id === uidv);
    if (!u0) return;
    const groups = u0.groups.includes(gcode) ? u0.groups.filter((x) => x !== gcode) : [...u0.groups, gcode];
    update((d) => ({ ...d, users: d.users.map((u) => (u.id === uidv ? { ...u, groups } : u)) }));
    adminUser("update", { id: uidv, groups });
    log(`Изменил состав группы ${gcode}`, "users");
  };

  return (
    <div className="px-4 py-10 md:px-9">
      <PageHeader title="Группы" subtitle="Группы открывают доступ к закрытым тестам." actions={manage && <Pill onClick={() => setAdding(!adding)}><Icon name="Plus" size={16} />Группа</Pill>} />
      {adding && (
        <div className="mb-6 flex flex-col gap-2 rounded-2xl bg-card p-4 sm:flex-row animate-fade-in">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" className="rounded-full bg-background" />
          <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))} placeholder="Код (латиницей)" className="rounded-full bg-background sm:max-w-[200px]" />
          <Pill onClick={add}>Создать</Pill>
        </div>
      )}
      {groups.length ? (
        <div className="grid gap-3.5 lg:grid-cols-2">
          {groups.map((g) => {
            const members = db.users.filter((u) => u.groups.includes(g.code));
            return (
              <div key={g.id} className="rounded-2xl bg-card p-5 animate-fade-in">
                <div className="flex items-start justify-between">
                  <div>
                    <small className="text-[0.85em] text-muted-foreground">#{g.code}</small>
                    <h3 className="font-head text-[1.3em] font-medium">{g.name}</h3>
                    {g.description && <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>}
                  </div>
                  <span className="rounded-full bg-accent px-3 py-1 text-sm">{members.length} чел.</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(manage ? db.users : members).map((u) => {
                    const on = u.groups.includes(g.code);
                    return (
                      <button key={u.id} disabled={!manage} onClick={() => toggleMember(u.id, g.code)} className={`rounded-full border px-3 py-1 text-sm transition-colors ${on ? "border-foreground/40 text-foreground" : "border-border text-muted-foreground/60 hover:text-muted-foreground"}`}>
                        {on && "✓ "}{u.nickname}
                      </button>
                    );
                  })}
                </div>
                {manage && (
                  <button onClick={() => { update((d) => ({ ...d, groups: d.groups.filter((x) => x.id !== g.id) })); log(`Удалил группу «${g.name}»`, "users"); }} className="mt-4 text-sm text-muted-foreground hover:text-destructive">Удалить группу</button>
                )}
              </div>
            );
          })}
        </div>
      ) : <Empty text="Вы пока не состоите ни в одной группе" />}
    </div>
  );
}
