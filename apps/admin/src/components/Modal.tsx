import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { t } from "../strings";
import { cx } from "./ui";

interface Props {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
  className?: string;
  /** Muestra la X y cierra al hacer clic fuera del diálogo. */
  dismissible?: boolean;
}

/** Diálogo nativo <dialog>: foco atrapado, Esc cierra y el resto de la página queda inerte. */
export function Modal({ open, title, onClose, children, className, dismissible }: Props) {
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
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={dismissible ? (e) => {
              // El fondo es el propio <dialog>: un clic dentro de su caja (relleno incluido) no cierra.
              const r = e.currentTarget.getBoundingClientRect();
              const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
              if (outside) onClose();
            } : undefined}
      className={cx(
        "m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100%-2rem),34rem)] overflow-y-auto rounded-lg border-2 border-line bg-surface p-4 text-ink shadow-hard-lg sm:p-6",
        className,
      )}
    >
      {open && (
        <>
          <div className="mb-5 flex items-start justify-between gap-3">
            <h2 className="break-words font-display text-xl font-bold">{title}</h2>
            {dismissible && (
              <button type="button" onClick={onClose} aria-label={t.common.close} className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-line/60 hover:text-ink">
                <X size={22} aria-hidden />
              </button>
            )}
          </div>
          {children}
        </>
      )}
    </dialog>
  );
}
