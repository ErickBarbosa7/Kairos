import { type ReactNode, useEffect, useRef } from "react";
import { cx } from "./ui";

interface Props {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
  className?: string;
}

/** Diálogo nativo <dialog>: foco atrapado, Esc cierra y el resto de la página queda inerte. */
export function Modal({ open, title, onClose, children, className }: Props) {
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
      className={cx(
        "m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100%-2rem),34rem)] overflow-y-auto rounded-lg border-2 border-line bg-surface p-4 text-ink shadow-hard-lg sm:p-6",
        className,
      )}
    >
      {open && (
        <>
          <h2 className="mb-5 break-words font-display text-xl font-bold">{title}</h2>
          {children}
        </>
      )}
    </dialog>
  );
}
