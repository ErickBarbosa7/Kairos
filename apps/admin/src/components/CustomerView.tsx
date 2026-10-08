import { useEffect, useRef } from "react";
import type { Reward, TenantBrand } from "../api/types";
import { t } from "../strings";
import { BrandPreview } from "./BrandPreview";
import { Button } from "./ui";

export function CustomerView({ open, brand, rewards, onClose }: { open: boolean; brand: TenantBrand; rewards: Reward[]; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  const visible = rewards.filter((r) => r.isActive).sort((a, b) => a.pointsCost - b.pointsCost);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={t.rewards.viewAsCustomer}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100%-2rem),26rem)] overflow-y-auto rounded-lg border-2 border-line bg-surface p-4 text-ink shadow-hard-lg sm:p-6"
    >
      <div className="flex flex-col gap-4">
        <BrandPreview name={brand.name} primary={brand.primaryColor} themeMode={brand.themeMode} logoUrl={brand.logoUrl} rewards={visible} />
        <p className="text-xs text-ink-2">{t.preview.sampleNote}</p>
        <Button type="button" onClick={onClose}>{t.common.close}</Button>
      </div>
    </dialog>
  );
}
