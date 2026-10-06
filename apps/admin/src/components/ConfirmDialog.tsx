import { useEffect, useRef } from "react";
import { t } from "../strings";
import { Button } from "./ui";

interface Props {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmDialog({ open, title, body, confirmLabel, danger, busy, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-labelledby="dlg-title"
      className="m-auto w-[min(92vw,28rem)] rounded-lg border border-line bg-surface p-6 text-ink shadow-xl"
    >
      <h2 id="dlg-title" className="font-display text-xl font-bold">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onCancel} disabled={busy}>
          {t.common.cancel}
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy} autoFocus>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
