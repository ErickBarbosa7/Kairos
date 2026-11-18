import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../api/auth";
import { useCampaigns, useDeleteCampaign, useSaveCampaign } from "../api/tenantPanel";
import type { Campaign, CampaignType } from "../api/types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { Button, Card, Field, Input, Select, Spinner } from "../components/ui";
import { HelpHint } from "../components/HelpHint";
import { t } from "../strings";

interface Draft {
  id?: string;
  name: string;
  type: CampaignType;
  isActive: boolean;
  multiplierPct: string;
  bonusPoints: string;
  unlockHours: string;
  startsAt: string;
  endsAt: string;
  weekdays: number[];
  startHour: string;
  endHour: string;
}

const blank: Draft = { name: "", type: "MULTIPLIER", isActive: true, multiplierPct: "200", bonusPoints: "20", unlockHours: "12", startsAt: "", endsAt: "", weekdays: [], startHour: "", endHour: "" };
const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const toDraft = (c: Campaign): Draft => ({
  id: c.id,
  name: c.name,
  type: c.type,
  isActive: c.isActive,
  multiplierPct: String(c.multiplierPct ?? 200),
  bonusPoints: String(c.bonusPoints ?? 20),
  unlockHours: String(c.unlockHours ?? 12),
  startsAt: dateInput(c.startsAt),
  endsAt: dateInput(c.endsAt),
  weekdays: c.weekdays,
  startHour: c.startHour === null ? "" : String(c.startHour),
  endHour: c.endHour === null ? "" : String(c.endHour),
});

const isInt = (s: string, min: number, max: number) => /^\d+$/.test(s) && Number(s) >= min && Number(s) <= max;

function summary(c: Campaign): string {
  if (c.type === "MULTIPLIER") return t.campaigns.summaryMult(c.multiplierPct ?? 100);
  if (c.type === "FIRST_VISIT_BONUS") return t.campaigns.summaryBonus(c.bonusPoints ?? 0);
  return t.campaigns.summaryUnlock(c.unlockHours ?? 0);
}

function when(c: Campaign): string {
  const days = c.weekdays.length ? c.weekdays.map((d) => t.campaigns.dayNames[d]).join(", ") : t.campaigns.everyDay;
  const hours = c.startHour !== null && c.endHour !== null ? t.campaigns.hoursRange(c.startHour, c.endHour) : t.campaigns.allDay;
  return `${days} · ${hours}`;
}

function CampaignForm({ initial, onClose }: { initial: Draft; onClose(): void }) {
  const save = useSaveCampaign();
  const toast = useToast();
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.name.trim().length < 2) errs.name = t.errors.required;
    if (f.type === "FIRST_VISIT_BONUS" && !isInt(f.bonusPoints, 1, 100_000)) errs.bonusPoints = t.campaigns.invalid;
    if (f.type === "COMEBACK_UNLOCK" && !isInt(f.unlockHours, 0, 720)) errs.unlockHours = t.campaigns.invalid;
    const hasHours = f.startHour !== "" || f.endHour !== "";
    if (hasHours && !(isInt(f.startHour, 0, 23) && isInt(f.endHour, 1, 24) && Number(f.startHour) < Number(f.endHour))) errs.endHour = t.campaigns.invalidHours;
    if (f.startsAt && f.endsAt && f.startsAt >= f.endsAt) errs.endsAt = t.campaigns.invalid;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await save.mutateAsync({
        id: f.id,
        name: f.name.trim(),
        type: f.type,
        isActive: f.isActive,
        multiplierPct: f.type === "MULTIPLIER" ? Number(f.multiplierPct) : null,
        bonusPoints: f.type === "FIRST_VISIT_BONUS" ? Number(f.bonusPoints) : null,
        unlockHours: f.type === "COMEBACK_UNLOCK" ? Number(f.unlockHours) : null,
        startsAt: f.startsAt ? new Date(`${f.startsAt}T00:00:00-06:00`).toISOString() : null,
        endsAt: f.endsAt ? new Date(`${f.endsAt}T23:59:59-06:00`).toISOString() : null,
        weekdays: f.weekdays,
        startHour: hasHours ? Number(f.startHour) : null,
        endHour: hasHours ? Number(f.endHour) : null,
      });
      toast(t.campaigns.saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "plan_limit") setErrors({ form: t.campaigns.planBlocked });
      else if (err instanceof ApiError && err.issues.length) setErrors(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
      else setErrors({ form: t.errors.generic });
    }
  }

  const toggleDay = (d: number) => setF({ ...f, weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d].sort() });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field floating label={t.campaigns.name} htmlFor="c-name" error={errors.name}>
        <Input id="c-name" value={f.name} maxLength={60} aria-invalid={!!errors.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label={t.campaigns.type} htmlFor="c-type" hint={t.campaigns.typeHelp[f.type]}>
        <Select id="c-type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as CampaignType })}>
          {(Object.keys(t.campaigns.types) as CampaignType[]).map((k) => (
            <option key={k} value={k}>{t.campaigns.types[k]}</option>
          ))}
        </Select>
      </Field>
      {f.type === "MULTIPLIER" && (
        <Field label={t.campaigns.multiplier} htmlFor="c-mult" error={errors.multiplierPct}>
          <Select id="c-mult" value={f.multiplierPct} onChange={(e) => setF({ ...f, multiplierPct: e.target.value })}>
            {t.campaigns.multiplierOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
      )}
      {f.type === "FIRST_VISIT_BONUS" && (
        <Field floating label={t.campaigns.bonusPoints} htmlFor="c-bonus" error={errors.bonusPoints}>
          <Input id="c-bonus" inputMode="numeric" value={f.bonusPoints} aria-invalid={!!errors.bonusPoints} onChange={(e) => setF({ ...f, bonusPoints: e.target.value })} />
        </Field>
      )}
      {f.type === "COMEBACK_UNLOCK" && (
        <Field floating label={t.campaigns.unlockHours} htmlFor="c-unlock" error={errors.unlockHours}>
          <Input id="c-unlock" inputMode="numeric" value={f.unlockHours} aria-invalid={!!errors.unlockHours} onChange={(e) => setF({ ...f, unlockHours: e.target.value })} />
        </Field>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">{t.campaigns.days}</legend>
        <div className="flex flex-wrap gap-2">
          {t.campaigns.dayNames.map((n, d) => (
            <label key={n} className={`flex min-h-11 min-w-12 cursor-pointer items-center justify-center gap-1 rounded-md border-2 border-line px-3 text-sm font-semibold ${f.weekdays.includes(d) ? "bg-primary text-white" : "bg-canvas"}`}>
              <input type="checkbox" className="sr-only" checked={f.weekdays.includes(d)} onChange={() => toggleDay(d)} />
              {n}
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-2">{t.campaigns.daysHint}</p>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field floating label={t.campaigns.startHour} htmlFor="c-sh" hint={t.campaigns.hoursHint}>
          <Input id="c-sh" inputMode="numeric" value={f.startHour} onChange={(e) => setF({ ...f, startHour: e.target.value })} />
        </Field>
        <Field floating label={t.campaigns.endHour} htmlFor="c-eh" error={errors.endHour}>
          <Input id="c-eh" inputMode="numeric" value={f.endHour} aria-invalid={!!errors.endHour} onChange={(e) => setF({ ...f, endHour: e.target.value })} />
        </Field>
        <Field label={t.campaigns.startsAt} htmlFor="c-sa">
          <Input id="c-sa" type="date" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
        </Field>
        <Field label={t.campaigns.endsAt} htmlFor="c-ea" error={errors.endsAt}>
          <Input id="c-ea" type="date" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} />
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} className="size-5 accent-primary" />
        {t.campaigns.active}
      </label>
      {errors.form && (
        <p role="alert" className="text-sm text-danger">
          {errors.form}{" "}
          {errors.form === t.campaigns.planBlocked && <Link to="/plan" className="font-semibold underline">{t.campaigns.planLink}</Link>}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" onClick={onClose} disabled={save.isPending}>{t.common.cancel}</Button>
        <Button type="submit" variant="primary" disabled={save.isPending}>{t.common.save}</Button>
      </div>
    </form>
  );
}

export function CampaignsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "tenant_admin";
  const { data, isPending, isError } = useCampaigns();
  const del = useDeleteCampaign();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<Campaign | null>(null);

  if (isPending) return <Spinner />;
  if (isError || !data) return <p className="text-sm text-danger">{t.campaigns.loadError}</p>;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            {t.campaigns.title} <em className="k">{t.campaigns.titleWord}</em> <HelpHint topic="campaigns" />
          </h1>
          <p className="mt-2 max-w-2xl text-ink-2">{t.campaigns.intro}</p>
        </div>
        {canEdit && (
          <Button variant="primary" onClick={() => setDraft(blank)}>
            <Plus size={16} aria-hidden /> {t.campaigns.new}
          </Button>
        )}
      </header>

      {data.data.length === 0 ? (
        <Card className="p-6 text-ink-2">{t.campaigns.empty}</Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.data.map((c) => (
            <li key={c.id} className="min-w-0">
              <Card className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 break-words font-display text-xl font-bold">{c.name}</h2>
                  <span className="shrink-0 rounded-md border-2 border-line px-2 py-1 text-xs font-semibold">{c.isActive ? t.campaigns.active : t.campaigns.paused}</span>
                </div>
                <p className="flex items-center gap-2 text-sm font-semibold"><Megaphone size={16} aria-hidden />{t.campaigns.types[c.type]}: {summary(c)}</p>
                <p className="text-sm text-ink-2">{when(c)}</p>
                {canEdit && (
                  <div className="mt-auto flex gap-2 border-t-2 border-line pt-3">
                    <Button className="flex-1" onClick={() => setDraft(toDraft(c))}><Pencil size={15} aria-hidden />{t.common.edit}</Button>
                    <Button variant="danger" className="size-11 px-0!" aria-label={`${t.campaigns.deleteTitle} ${c.name}`} onClick={() => setToDelete(c)}><Trash2 size={16} aria-hidden /></Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={draft !== null} title={draft?.id ? t.common.edit : t.campaigns.new} onClose={() => setDraft(null)} dismissible>
        {draft && <CampaignForm key={draft.id ?? "new"} initial={draft} onClose={() => setDraft(null)} />}
      </Modal>
      <ConfirmDialog
        open={toDelete !== null}
        title={t.campaigns.deleteTitle}
        body={toDelete ? t.campaigns.deleteBody(toDelete.name) : ""}
        confirmLabel={t.campaigns.deleteTitle}
        danger
        busy={del.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await del.mutateAsync(toDelete.id);
          toast(t.campaigns.deleted);
          setToDelete(null);
        }}
      />
    </div>
  );
}
