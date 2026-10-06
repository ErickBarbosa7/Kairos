import { EyeOff, Gift, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "../api/auth";
import { ApiError } from "../api/client";
import type { Reward } from "../api/types";
import { useDeleteReward, useRewards, useSaveReward } from "../api/tenantPanel";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ImageUpload } from "../components/ImageUpload";
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
    if (!Number.isInteger(cost) || cost < 1) errs.pointsCost = "Debe ser un entero mayor a 0";
    if (f.stock !== "" && (!Number.isInteger(Number(f.stock)) || Number(f.stock) < 0)) errs.stock = "Debe ser un entero de 0 o más";
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
      className="m-auto max-h-[92vh] w-[min(94vw,34rem)] overflow-y-auto rounded-lg border border-line bg-surface p-6 text-ink shadow-xl"
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
        {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
        <div className="flex justify-end gap-2">
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

export function RewardsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "tenant_admin";
  const { data, isPending, isError } = useRewards();
  const del = useDeleteReward();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<Reward | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            {t.rewards.title} <em className="k">{t.rewards.titleWord}</em>
          </h1>
          <p className="mt-2 text-ink-2">{canEdit ? t.rewards.intro : t.rewards.readOnly}</p>
        </div>
        {canEdit && (
          <Button variant="primary" onClick={() => setDraft(blank)}>
            <Plus size={18} aria-hidden /> {t.rewards.new}
          </Button>
        )}
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
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((r) => {
            const soldOut = r.stock === 0;
            return (
              <li key={r.id}>
                <Card className="flex h-full flex-col overflow-hidden">
                  <div className="grid aspect-[16/9] place-items-center bg-canvas">
                    {r.imageUrl ? (
                      <img src={r.imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <Gift size={36} className="text-ink-3" aria-hidden />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-display text-lg font-bold leading-tight">{r.title}</h2>
                      <span className="shrink-0 rounded-full bg-reward/20 px-2.5 py-1 font-mono text-xs font-medium tabular-nums">
                        {r.pointsCost} {t.rewards.pts}
                      </span>
                    </div>
                    {r.description && <p className="text-sm text-ink-2">{r.description}</p>}
                    <div className="mt-auto flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className={soldOut ? "text-danger" : "text-ink-2"}>
                        {r.stock === null ? t.rewards.unlimited : soldOut ? t.rewards.soldOut : t.rewards.left(r.stock)}
                      </span>
                      {!r.isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-line/60 px-2.5 py-1 text-ink-2">
                          <EyeOff size={13} aria-hidden /> {t.rewards.inactive}
                        </span>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex gap-2 border-t border-line pt-3">
                        <Button className="flex-1" onClick={() => setDraft(toDraft(r))}>
                          <Pencil size={15} aria-hidden /> {t.common.edit}
                        </Button>
                        <Button variant="ghost" aria-label={`${t.rewards.delete} ${r.title}`} onClick={() => setToDelete(r)}>
                          <Trash2 size={16} aria-hidden />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

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
