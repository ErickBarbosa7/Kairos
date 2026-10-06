import { Check, Copy, Cpu, MapPin, Pencil, Plus, ShieldOff, Store as StoreIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useAuth } from "../api/auth";
import { ApiError } from "../api/client";
import type { Machine, Store } from "../api/types";
import { useCreateMachine, useMachines, useRevokeMachine, useSaveStore, useStores } from "../api/tenantPanel";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { Button, Card, cx, Field, Input, Select, Spinner, Textarea } from "../components/ui";
import { t } from "../strings";

function CopyId({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 1800);
        } catch {
          /* sin portapapeles: el ID sigue visible para copiarlo a mano */
        }
      }}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-sm px-2 text-xs font-semibold text-link hover:bg-line/50"
      aria-label={`${t.stores.copy} ${t.stores.storeId}`}
    >
      {done ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {done ? t.stores.copied : t.stores.copy}
    </button>
  );
}

function StoreModal({ store, open, onClose }: { store: Partial<Store> | null; open: boolean; onClose(): void }) {
  const save = useSaveStore();
  const toast = useToast();
  const [name, setName] = useState(store?.name ?? "");
  const [address, setAddress] = useState(store?.address ?? "");
  const [active, setActive] = useState(store?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setError(t.errors.required);
    try {
      await save.mutateAsync({ id: store?.id, name: name.trim(), address: address.trim() || null, ...(store?.id && { isActive: active }) });
      toast(t.stores.saved);
      onClose();
    } catch {
      setError(t.errors.generic);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={store?.id ? t.stores.editTitle : t.stores.newTitle}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field floating label={t.stores.name} htmlFor="s-name" error={error ?? undefined}>
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!error} />
        </Field>
        <Field floating label={t.stores.address} htmlFor="s-addr">
          <Input id="s-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        {store?.id && (
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-primary" />
            {t.stores.active}
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>{t.common.cancel}</Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>{t.common.save}</Button>
        </div>
      </form>
    </Modal>
  );
}

function MachineModal({ store, onClose }: { store: Store | null; onClose(): void }) {
  const create = useCreateMachine();
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [algorithm, setAlgorithm] = useState<"ES256" | "EDDSA">("ES256");
  const [key, setKey] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (label.trim().length < 2) errs.label = t.errors.required;
    if (key.trim().length < 40) errs.publicKey = t.errors.required;
    setErrors(errs);
    if (Object.keys(errs).length || !store) return;
    try {
      await create.mutateAsync({ storeId: store.id, label: label.trim(), keyAlgorithm: algorithm, publicKey: key.trim() });
      toast(t.stores.machineSaved);
      onClose();
    } catch (err) {
      setErrors({ publicKey: err instanceof ApiError ? err.message : t.errors.generic });
    }
  }

  return (
    <Modal open={!!store} onClose={onClose} title={`${t.stores.machineTitle} · ${store?.name ?? ""}`} className="w-[min(94vw,40rem)]">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field floating label={t.stores.machineLabel} htmlFor="m-label" error={errors.label}>
            <Input id="m-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <Field label={t.stores.algorithm} htmlFor="m-alg">
            <Select id="m-alg" value={algorithm} onChange={(e) => setAlgorithm(e.target.value as "ES256" | "EDDSA")}>
              <option value="ES256">ES256 (P-256)</option>
              <option value="EDDSA">EdDSA (Ed25519)</option>
            </Select>
          </Field>
        </div>
        <Field floating multiline label={t.stores.publicKey} htmlFor="m-key" hint={t.stores.publicKeyHint} error={errors.publicKey}>
          <Textarea id="m-key" value={key} onChange={(e) => setKey(e.target.value)} spellCheck={false} className="font-mono text-xs" aria-invalid={!!errors.publicKey} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>{t.common.cancel}</Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>{t.stores.addMachine}</Button>
        </div>
      </form>
    </Modal>
  );
}

function MachineRow({ m, canEdit, onRevoke }: { m: Machine; canEdit: boolean; onRevoke(m: Machine): void }) {
  const active = m.status === "ACTIVE";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Cpu size={18} className="shrink-0 text-ink-3" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{m.label}</p>
          <p className="font-mono text-xs text-ink-2">{m.keyAlgorithm}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", active ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
          {active ? <Check size={13} aria-hidden /> : <ShieldOff size={13} aria-hidden />}
          {active ? t.stores.machineActive : t.stores.machineRevoked}
        </span>
        {canEdit && active && (
          <Button variant="ghost" onClick={() => onRevoke(m)}>{t.stores.revoke}</Button>
        )}
      </div>
    </li>
  );
}

export function StoresPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "tenant_admin";
  const stores = useStores();
  const machines = useMachines();
  const revoke = useRevokeMachine();
  const toast = useToast();
  const [storeModal, setStoreModal] = useState<Partial<Store> | null>(null);
  const [machineStore, setMachineStore] = useState<Store | null>(null);
  const [toRevoke, setToRevoke] = useState<Machine | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            {t.stores.title} <em className="k">{t.stores.titleWord}</em>
          </h1>
          <p className="mt-2 text-ink-2">{t.stores.intro}</p>
        </div>
        {canEdit && (
          <Button variant="primary" onClick={() => setStoreModal({})}>
            <Plus size={18} aria-hidden /> {t.stores.new}
          </Button>
        )}
      </header>

      {stores.isPending ? (
        <Spinner />
      ) : stores.isError ? (
        <p className="text-sm text-danger">{t.errors.generic}</p>
      ) : stores.data.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <StoreIcon size={32} className="text-ink-3" aria-hidden />
          <p className="max-w-sm text-sm text-ink-2">{t.stores.empty}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-5">
          {stores.data.map((s) => {
            const list = (machines.data ?? []).filter((m) => m.storeId === s.id);
            return (
              <li key={s.id}>
                <Card className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
                        {s.name}
                        {!s.isActive && <span className="rounded-full bg-line/60 px-2.5 py-0.5 font-sans text-xs font-semibold text-ink-2">{t.stores.inactive}</span>}
                      </h2>
                      {s.address && (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
                          <MapPin size={14} aria-hidden /> {s.address}
                        </p>
                      )}
                      <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-ink-2">
                        {t.stores.storeId}: <code className="break-all font-mono">{s.id}</code>
                        <CopyId value={s.id} />
                      </p>
                    </div>
                    {canEdit && (
                      <Button onClick={() => setStoreModal(s)}>
                        <Pencil size={15} aria-hidden /> {t.common.edit}
                      </Button>
                    )}
                  </div>

                  <div className="mt-5 border-t border-line pt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-ink-2">{t.stores.machines}</h3>
                      {canEdit && s.isActive && (
                        <Button onClick={() => setMachineStore(s)}>
                          <Plus size={15} aria-hidden /> {t.stores.addMachine}
                        </Button>
                      )}
                    </div>
                    {list.length === 0 ? (
                      <p className="py-4 text-sm text-ink-2">{t.stores.noMachines}</p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {list.map((m) => (
                          <MachineRow key={m.id} m={m} canEdit={canEdit} onRevoke={setToRevoke} />
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* key fuerza estado limpio en cada apertura */}
      <StoreModal key={`store-${storeModal?.id ?? (storeModal ? "new" : "closed")}`} store={storeModal} open={!!storeModal} onClose={() => setStoreModal(null)} />
      <MachineModal key={`machine-${machineStore?.id ?? "closed"}`} store={machineStore} onClose={() => setMachineStore(null)} />
      <ConfirmDialog
        open={!!toRevoke}
        danger
        busy={revoke.isPending}
        title={t.stores.revokeTitle}
        body={toRevoke ? t.stores.revokeBody(toRevoke.label) : ""}
        confirmLabel={t.stores.revoke}
        onCancel={() => setToRevoke(null)}
        onConfirm={async () => {
          if (!toRevoke) return;
          await revoke.mutateAsync(toRevoke.id);
          toast(t.stores.revoked);
          setToRevoke(null);
        }}
      />
    </div>
  );
}
