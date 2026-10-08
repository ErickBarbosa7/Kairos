import { AlertCircle, Eye, EyeOff, Gift, Pencil, Plus, Smartphone, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "../api/auth";
import { ApiError } from "../api/client";
import type { Reward } from "../api/types";
import { useDeleteReward, useRewards, useSaveReward } from "../api/tenantPanel";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CustomerView } from "../components/CustomerView";
import { ImageUpload } from "../components/ImageUpload";
import { RewardPreview } from "../components/RewardPreview";
import { useToast } from "../components/Toast";
import { Button, Card, Field, Input, Spinner } from "../components/ui";
import { t } from "../strings";

interface Draft {
  id?: string;
  title: string;
  description: string;
  imageUrl: string | null;
  pointsCost: string;
  stock: string;
  isActive: boolean;
}

const blank: Draft = { title: "", description: "", imageUrl: null, pointsCost: "", stock: "", isActive: true };
const toDraft = (r: Reward): Draft => ({
  id: r.id,
  title: r.title,
  description: r.description ?? "",
  imageUrl: r.imageUrl,
  pointsCost: String(r.pointsCost),
  stock: r.stock === null ? "" : String(r.stock),
  isActive: r.isActive,
});

function RewardDialog({ draft, onClose }: { draft: Draft | null; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const save = useSaveReward();
  const toast = useToast();
  const [f, setF] = useState<Draft>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (draft) {
      setF(draft);
      setErrors({});
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [draft]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.title.trim().length < 2) errs.title = t.errors.required;
    const cost = Number(f.pointsCost);
    if (!Number.isInteger(cost) || cost < 1) errs.pointsCost = t.rewards.invalidCost;
    if (f.stock !== "" && (!Number.isInteger(Number(f.stock)) || Number(f.stock) < 0)) errs.stock = t.rewards.invalidStock;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await save.mutateAsync({
        id: f.id,
        title: f.title.trim(),
        description: f.description.trim() || null,
        imageUrl: f.imageUrl,
        pointsCost: cost,
        stock: f.stock === "" ? null : Number(f.stock),
        isActive: f.isActive,
      });
      toast(t.rewards.saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.issues.length) setErrors(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
      else setErrors({ form: t.errors.generic });
    }
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="reward-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100%-2rem),34rem)] overflow-y-auto rounded-lg border-2 border-line bg-surface p-4 text-ink shadow-hard-lg sm:p-6"
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <h2 id="reward-title" className="font-display text-xl font-bold">
          {f.id ? t.rewards.editTitle : t.rewards.newTitle}
        </h2>
        <Field floating label={t.rewards.name} htmlFor="r-title" error={errors.title}>
          <Input id="r-title" value={f.title} aria-invalid={!!errors.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field floating label={t.rewards.description} htmlFor="r-desc" error={errors.description}>
          <Input id="r-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field floating label={t.rewards.cost} htmlFor="r-cost" error={errors.pointsCost}>
            <Input id="r-cost" inputMode="numeric" value={f.pointsCost} aria-invalid={!!errors.pointsCost} onChange={(e) => setF({ ...f, pointsCost: e.target.value })} />
          </Field>
          <Field floating label={t.rewards.stock} htmlFor="r-stock" hint={t.rewards.stockHint} error={errors.stock}>
            <Input id="r-stock" inputMode="numeric" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} />
          </Field>
        </div>
        <ImageUpload label={t.rewards.image} value={f.imageUrl} onChange={(u) => setF({ ...f, imageUrl: u })} />
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} className="size-5 accent-primary" />
          {t.rewards.active}
        </label>
        <RewardPreview title={f.title} description={f.description} imageUrl={f.imageUrl} pointsCost={f.pointsCost} stock={f.stock} isActive={f.isActive} />
        {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" onClick={onClose} disabled={save.isPending}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {t.common.save}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

function RewardCard({ reward: r, canEdit, onEdit, onDelete }: { reward: Reward; canEdit: boolean; onEdit(): void; onDelete(): void }) {
  const save = useSaveReward();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const soldOut = r.stock === 0;
  const status = !r.isActive
    ? { text: t.rewards.statusHidden, icon: <EyeOff size={14} aria-hidden /> }
    : soldOut
      ? { text: t.rewards.statusSoldOut, icon: <AlertCircle size={14} aria-hidden /> }
      : { text: t.rewards.statusLive, icon: <Eye size={14} aria-hidden /> };
  const label = r.isActive ? t.rewards.hide(r.title) : t.rewards.show(r.title);

  async function toggleVisibility() {
    if (save.isPending) return;
    setError(null);
    try {
      await save.mutateAsync({ id: r.id, isActive: !r.isActive });
      toast(r.isActive ? t.rewards.hidden : t.rewards.shown);
    } catch {
      setError(t.rewards.visibilityError);
    }
  }

  return (
    <li className="min-w-0">
      <Card className="flex h-full flex-col overflow-hidden" aria-busy={save.isPending}>
        <div className="relative grid aspect-[16/9] place-items-center bg-canvas">
          <div className={`grid size-full place-items-center ${r.isActive ? "" : "opacity-50 grayscale"}`}>
            {r.imageUrl ? <img src={r.imageUrl} alt="" className="size-full object-cover" /> : <Gift size={36} className="text-ink-3" aria-hidden />}
          </div>
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md border-2 border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink">
            {status.icon}
            {status.text}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="min-w-0 flex-1 break-words font-display text-xl font-bold leading-tight">{r.title}</h2>
            <span className="shrink-0 rounded-md bg-reward/20 px-2.5 py-1 font-mono text-xs font-medium tabular-nums">
              {r.pointsCost} {t.rewards.pts}
            </span>
          </div>
          {r.description && <p className="break-words text-sm text-ink-2">{r.description}</p>}
          <p className="mt-auto text-xs font-semibold text-ink-2">
            {r.stock === null ? t.rewards.unlimited : soldOut ? t.rewards.soldOut : t.rewards.left(r.stock)}
          </p>
          {canEdit && (
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-medium">
              {t.rewards.visibilitySwitch}
              <button
                type="button"
                role="switch"
                aria-checked={r.isActive}
                aria-label={label}
                disabled={save.isPending}
                onClick={() => void toggleVisibility()}
                className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-line transition-colors ${r.isActive ? "bg-primary" : "bg-canvas"}`}
              >
                <span className={`absolute top-0.5 size-5 rounded-full bg-surface border-2 border-line transition-all ${r.isActive ? "left-[1.35rem]" : "left-0.5"}`} />
              </button>
            </label>
          )}
          {error && <p role="alert" className="flex items-start gap-2 text-sm text-danger"><AlertCircle size={16} aria-hidden className="mt-0.5 shrink-0" />{error}</p>}
          {canEdit && (
            <div className="flex gap-2 border-t-2 border-line pt-3">
              <Button className="flex-1" disabled={save.isPending} onClick={onEdit}><Pencil size={15} aria-hidden />{t.common.edit}</Button>
              <Button variant="danger" className="size-11 px-0!" disabled={save.isPending} aria-label={`${t.rewards.delete} ${r.title}`} onClick={onDelete}><Trash2 size={16} aria-hidden /></Button>
            </div>
          )}
        </div>
      </Card>
    </li>
  );
}

export function RewardsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "tenant_admin";
  const { data, isPending, isError } = useRewards();
  const del = useDeleteReward();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<Reward | null>(null);
  const [customerView, setCustomerView] = useState(false);
  const brand = user && user.role !== "super_admin" ? user.tenant : null;
  const [filter, setFilter] = useState<"all" | "visible" | "hidden">("all");
  const visibleCount = data?.filter((r) => r.isActive).length ?? 0;
  const hiddenCount = (data?.length ?? 0) - visibleCount;
  const shown = data?.filter((r) => filter === "all" || (filter === "visible") === r.isActive) ?? [];
  const filters = [
    { key: "all", label: t.rewards.filterAll },
    { key: "visible", label: t.rewards.filterVisible },
    { key: "hidden", label: t.rewards.filterHidden },
  ] as const;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            {t.rewards.title} <em className="k">{t.rewards.titleWord}</em>
          </h1>
          <p className="mt-2 text-ink-2">{canEdit ? t.rewards.intro : t.rewards.readOnly}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {brand && data && (
            <Button onClick={() => setCustomerView(true)}>
              <Smartphone size={18} aria-hidden /> {t.rewards.viewAsCustomer}
            </Button>
          )}
          {canEdit && (
            <Button variant="primary" onClick={() => setDraft(blank)}>
              <Plus size={18} aria-hidden /> {t.rewards.new}
            </Button>
          )}
        </div>
      </header>

      {isPending ? (
        <Spinner />
      ) : isError ? (
        <p className="text-sm text-danger">{t.errors.generic}</p>
      ) : data.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Gift size={32} className="text-ink-3" aria-hidden />
          <p className="max-w-sm text-sm text-ink-2">{t.rewards.empty}</p>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label={t.rewards.filterLabel} className="flex rounded-md border border-line p-0.5">
              {filters.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={filter === o.key}
                  onClick={() => setFilter(o.key)}
                  className={`min-h-11 rounded-sm px-3 text-xs font-semibold ${filter === o.key ? "bg-primary text-on-primary" : "text-ink-2"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p role="status" className="text-sm font-medium text-ink-2">{t.rewards.counts(visibleCount, hiddenCount)}</p>
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-ink-2">{t.rewards.emptyFilter}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((r) => (
                <RewardCard key={r.id} reward={r} canEdit={canEdit} onEdit={() => setDraft(toDraft(r))} onDelete={() => setToDelete(r)} />
              ))}
            </ul>
          )}
        </>
      )}

      {brand && data && <CustomerView open={customerView} brand={brand} rewards={data} onClose={() => setCustomerView(false)} />}
      <RewardDialog draft={draft} onClose={() => setDraft(null)} />
      <ConfirmDialog
        open={!!toDelete}
        danger
        busy={del.isPending}
        title={t.rewards.deleteTitle}
        body={toDelete ? t.rewards.deleteBody(toDelete.title) : ""}
        confirmLabel={t.rewards.delete}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await del.mutateAsync(toDelete.id);
          toast(t.rewards.deleted);
          setToDelete(null);
        }}
      />
    </div>
  );
}
