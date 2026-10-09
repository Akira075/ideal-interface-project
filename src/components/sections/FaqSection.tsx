import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Icon from "@/components/ui/icon";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/seed";
import PageHeader, { Pill, Empty } from "@/components/app/PageHeader";

export default function FaqSection() {
  const { db, can, update, log, setView } = useStore();
  const manage = can("faq.manage");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [a, setA] = useState("");

  const add = () => {
    if (!q.trim() || !a.trim()) return;
    update((d) => ({ ...d, faq: [...d.faq, { id: uid("f"), q, a }] }));
    log(`Добавил вопрос в FAQ «${q}»`, "content");
    setQ(""); setA(""); setOpen(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-9">
      <PageHeader title="Вопросы и ответы" subtitle="Короткие ответы на частые вопросы." actions={manage && <Pill onClick={() => setOpen(!open)}><Icon name="Plus" size={16} />Вопрос</Pill>} />
      {open && (
        <div className="mb-6 space-y-3 rounded-2xl bg-card p-5 animate-fade-in">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Вопрос" className="rounded-xl bg-background" />
          <Textarea rows={3} value={a} onChange={(e) => setA(e.target.value)} placeholder="Ответ" className="rounded-xl bg-background" />
          <div className="flex justify-end"><Pill onClick={add}>Добавить</Pill></div>
        </div>
      )}
      {db.faq.length ? (
        <Accordion type="single" collapsible className="space-y-2.5">
          {db.faq.map((f) => (
            <AccordionItem key={f.id} value={f.id} className="rounded-2xl border-0 bg-card px-5">
              <AccordionTrigger className="text-left font-head text-[1.1em] font-medium hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-[15px] text-muted-foreground">
                {f.a}
                {manage && (
                  <button onClick={() => { update((d) => ({ ...d, faq: d.faq.filter((x) => x.id !== f.id) })); log("Удалил вопрос из FAQ", "content"); }} className="mt-3 block text-sm hover:text-destructive">Удалить</button>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : <Empty text="Вопросов пока нет" />}
      <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-border p-8 text-center">
        <p className="text-muted-foreground">Не нашли ответ?</p>
        <Pill variant="outline" onClick={() => setView("support")}>Написать в поддержку</Pill>
      </div>
    </div>
  );
}
