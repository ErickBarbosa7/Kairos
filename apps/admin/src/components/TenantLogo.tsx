export function TenantLogo({ logoUrl, color, className = "size-9" }: { logoUrl: string | null; color: string; className?: string }) {
  return logoUrl ? (
    <img src={logoUrl} alt="" className={`${className} shrink-0 rounded-md border border-line bg-surface object-contain`} />
  ) : (
    <span aria-hidden className={`${className} shrink-0 rounded-md border border-line`} style={{ background: color }} />
  );
}
