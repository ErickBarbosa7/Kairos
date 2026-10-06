import { CheckCircle2, PauseCircle, Pencil, Plus, UserRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "../api/client";
import type { Staff } from "../api/types";
import { useSaveStaff, useStaff, useStores } from "../api/tenantPanel";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Modal } from "../components/Modal";
import { useToast } from "../components/Toast";
import { Button, Card, cx, Field, Input, Select, Spinner } from "../components/ui";
import { t } from "../strings";

function StaffModal({ staff, onClose }: { staff: Partial<Staff> | null; onClose(): void }) {
  const save = useSaveStaff();
  const stores = useStores();
  const toast = useToast();
  const editing = !!staff?.id;
  const [name, setName] = useState(staff?.name ?? "");
  const [email, setEmail] = useState(staff?.email ?? "");
  const [password, setPassword] = useState("");
  const [storeId, setStoreId] = useState(staff?.storeId ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = t.errors.required;
    if (!editing && !/^\S+@\S+\.\S+$/.test(email)) errs.email = "Correo inválido";
    if ((!editing || password) && password.length < 10) errs.password = "Mínimo 10 caracteres";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await save.mutateAsync({
        id: staff?.id,
        name: name.trim(),
        storeId: storeId || null,
        ...(!editing && { email: email.trim() }),
        ...(password && { password }),
      });
      toast(t.staff.saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ email: "Ya existe un empleado con ese correo" });
      else if (err instanceof ApiError && err.issues.length) setErrors(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
      else setErrors({ form: t.errors.generic });
    }
  }

  return (
    <Modal open={!!staff} onClose={onClose} title={editing ? t.staff.editTitle : t.staff.newTitle}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field floating label={t.staff.name} htmlFor="u-name" error={errors.name}>
          <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
        </Field>
        <Field floating label={t.staff.email} htmlFor="u-email" error={errors.email}>
          <Input id="u-email" type="email" autoComplete="off" value={email} disabled={editing} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
        </Field>
        <Field floating label={editing ? t.staff.newPassword : t.staff.password} htmlFor="u-pass" hint={editing ? t.staff.passwordHint : undefined} error={errors.password}>
          <Input id="u-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
        </Field>
        <Field label={t.staff.store} htmlFor="u-store">
          <Select id="u-store" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">{t.staff.allStores}</option>
            {(stores.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
        {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>{t.common.cancel}</Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>{t.common.save}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function StaffPage() {
  const staff = useStaff();
  const stores = useStores();
  const save = useSaveStaff();
  const toast = useToast();
  const [modal, setModal] = useState<Partial<Staff> | null>(null);
  const [toDeactivate, setToDeactivate] = useState<Staff | null>(null);
  const storeName = (id: string | null) => (id ? stores.data?.find((s) => s.id === id)?.name ?? "—" : t.staff.allStores);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            {t.staff.title} <em className="k">{t.staff.titleWord}</em>
          </h1>
          <p className="mt-2 text-ink-2">{t.staff.intro}</p>
        </div>
        <Button variant="primary" onClick={() => setModal({})}>
          <Plus size={18} aria-hidden /> {t.staff.new}
        </Button>
      </header>

      <Card className="overflow-hidden">
        {staff.isPending ? (
          <div className="p-8"><Spinner /></div>
        ) : staff.isError ? (
          <p className="p-8 text-sm text-danger">{t.errors.generic}</p>
        ) : staff.data.length === 0 ? (
          <p className="p-10 text-center text-sm text-ink-2">{t.staff.empty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {staff.data.map((u) => {
              const isAdmin = u.role === "TENANT_ADMIN";
              return (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-link">
                      <UserRound size={18} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {u.name}
                        {isAdmin && <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs font-medium text-ink-2">{t.staff.admin}</span>}
                      </p>
                      <p className="truncate text-sm text-ink-2">{u.email} · {storeName(u.storeId)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", u.isActive ? "bg-success/10 text-success" : "bg-line/60 text-ink-2")}>
                      {u.isActive ? <CheckCircle2 size={13} aria-hidden /> : <PauseCircle size={13} aria-hidden />}
                      {u.isActive ? t.staff.active : t.staff.inactive}
                    </span>
                    {!isAdmin && (
                      <>
                        <Button onClick={() => setModal(u)}>
                          <Pencil size={15} aria-hidden /> {t.common.edit}
                        </Button>
                        {u.isActive ? (
                          <Button onClick={() => setToDeactivate(u)}>{t.staff.deactivate}</Button>
                        ) : (
                          <Button
                            onClick={async () => {
                              await save.mutateAsync({ id: u.id, isActive: true });
                              toast(t.staff.activated);
                            }}
                          >
                            {t.staff.activate}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <StaffModal key={modal?.id ?? (modal ? "new" : "closed")} staff={modal} onClose={() => setModal(null)} />
      <ConfirmDialog
        open={!!toDeactivate}
        danger
        busy={save.isPending}
        title={t.staff.deactivateTitle}
        body={toDeactivate ? t.staff.deactivateBody(toDeactivate.name) : ""}
        confirmLabel={t.staff.deactivate}
        onCancel={() => setToDeactivate(null)}
        onConfirm={async () => {
          if (!toDeactivate) return;
          await save.mutateAsync({ id: toDeactivate.id, isActive: false });
          toast(t.staff.deactivated);
          setToDeactivate(null);
        }}
      />
    </div>
  );
}
