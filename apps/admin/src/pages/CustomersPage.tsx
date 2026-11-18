import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, UserRound } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { useAdjustPoints, useCustomer, useCustomers } from "../api/tenantPanel";
import type { CustomerConsumer } from "../api/types";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { Button, Card, cx, Field, Input, Spinner } from "../components/ui";
import { formatDate } from "../lib/format";
import { HelpHint } from "../components/HelpHint";
import { t } from "../strings";

const stamp = new Intl.DateTimeFormat("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const nameOf = (c: CustomerConsumer) => c.displayName || c.email || t.customers.guestShort(c.id);

function AdjustForm({ id, onDone }: { id: string; onDone(): void }) {
  const adjust = useAdjustPoints();
  const toast = useToast();
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(points);
    const errs: Record<string, string> = {};
    if (!Number.isInteger(n) || n === 0) errs.points = t.customers.adjustZero;
    if (note.trim().length < 3) errs.note = t.customers.adjustNote3;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await adjust.mutateAsync({ id, points: n, note: note.trim() });
      toast(t.customers.adjustSaved);
      setPoints("");
      setNote("");
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors({ points: t.customers.adjustNegative });
      else setErrors({ form: t.errors.generic });
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-lg border border-line p-4">
      <p className="text-sm text-ink-2">{t.customers.adjustIntro}</p>
      <Field floating label={t.customers.adjustPoints} htmlFor="adj-points" error={errors.points}>
        <Input id="adj-points" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} aria-invalid={!!errors.points} />
      </Field>
      <Field floating label={t.customers.adjustNote} htmlFor="adj-note" error={errors.note}>
        <Input id="adj-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={!!errors.note} />
      </Field>
      {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
      <Button type="submit" variant="primary" disabled={adjust.isPending}>
        <SlidersHorizontal size={16} aria-hidden /> {t.customers.adjust}
      </Button>
    </form>
  );
}

function CustomerModal({ id, onClose }: { id: string | null; onClose(): void }) {
  const detail = useCustomer(id);
  const d = detail.data;
  return (
    <Modal open={!!id} onClose={onClose} title={d ? nameOf(d.consumer) : t.common.loading} dismissible>
      {!d ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-ink-2">{t.customers.balance}</dt><dd className="font-display text-3xl font-extrabold">{d.balance}</dd></div>
            <div><dt className="text-ink-2">{t.customers.lifetime}</dt><dd className="font-display text-3xl font-extrabold">{d.lifetimeEarned}</dd></div>
            <div><dt className="text-ink-2">{t.customers.joined}</dt><dd>{formatDate(d.joinedAt)}</dd></div>
            <div><dt className="text-ink-2">{t.customers.lastActivity}</dt><dd>{formatDate(d.lastActivityAt)}</dd></div>
            {(Object.keys(t.customers.coupons) as (keyof typeof t.customers.coupons)[]).map((k) => (
              <div key={k}><dt className="text-ink-2">{t.customers.coupons[k]}</dt><dd>{d.coupons[k] ?? 0}</dd></div>
            ))}
          </dl>
          <AdjustForm id={d.id} onDone={() => undefined} />
          <section>
            <h3 className="mb-2 font-semibold">{t.customers.movements}</h3>
            {d.transactions.length === 0 ? (
              <p className="text-sm text-ink-2">{t.customers.noMovements}</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.transactions.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{t.customers.type[m.type]}</p>
                      <p className="truncate text-ink-2">{stamp.format(new Date(m.createdAt))}{m.note ? ` · ${m.note}` : ""}</p>
                    </div>
                    <p className={cx("shrink-0 font-semibold", m.points > 0 ? "text-success" : "text-danger")}>
                      {m.points > 0 ? "+" : "−"}{Math.abs(m.points)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

export function CustomersPage() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const list = useCustomers(q, page);

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(input.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [input]);

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.limit)) : 1;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {t.customers.title} <em className="k">{t.customers.titleWord}</em> <HelpHint topic="customers" />
        </h1>
        <p className="mt-2 text-ink-2">{t.customers.intro}</p>
      </header>

      <div className="relative max-w-md">
        <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-2" />
        <Input aria-label={t.customers.search} placeholder={t.customers.search} className="pl-9" value={input} onChange={(e) => setInput(e.target.value)} />
      </div>

      <Card className="overflow-hidden">
        {list.isPending ? (
          <div className="p-8"><Spinner /></div>
        ) : list.isError ? (
          <p className="p-8 text-sm text-danger">{t.errors.generic}</p>
        ) : list.data.data.length === 0 ? (
          <p className="p-10 text-center text-sm text-ink-2">{q ? t.customers.noResults : t.customers.empty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.data.data.map((w) => (
              <li key={w.id}>
                <button type="button" onClick={() => setOpen(w.id)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-line/30">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-link"><UserRound size={18} aria-hidden /></span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {nameOf(w.consumer)}
                        {w.consumer.isGuest && <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs font-medium text-ink-2">{t.customers.guest}</span>}
                      </span>
                      <span className="block truncate text-sm text-ink-2">{t.customers.lastActivity}: {formatDate(w.lastActivityAt)}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-2xl font-extrabold">{w.balance}</span>
                    <span className="block text-xs text-ink-2">{t.customers.points}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {list.data && pages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label={t.customers.page(page, pages)}>
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} aria-hidden /> {t.customers.prev}</Button>
          <span className="text-sm text-ink-2">{t.customers.page(page, pages)}</span>
          <Button disabled={page >= pages} onClick={() => setPage(page + 1)}>{t.customers.next} <ChevronRight size={16} aria-hidden /></Button>
        </nav>
      )}

      <CustomerModal key={open ?? "closed"} id={open} onClose={() => setOpen(null)} />
    </div>
  );
}
