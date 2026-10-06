import { ChevronLeft, ChevronRight, PauseCircle, Pencil, Play, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSetTenantStatus, useTenantCount, useTenants } from "../api/tenants";
import type { Tenant, TenantStatus } from "../api/types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";
import { Button, Card, Input, Select, Spinner, StatusBadge } from "../components/ui";
import { formatDate } from "../lib/format";
import { t } from "../strings";

function Stat({ label, status, tone }: { label: string; status?: TenantStatus; tone: string }) {
  const { data } = useTenantCount(status);
  return (
    <Card className="flex flex-col gap-1 p-5">
      <span className="text-sm font-medium text-ink-2">{label}</span>
      <span className={`font-display text-4xl font-extrabold tabular-nums ${tone}`}>{data ?? "–"}</span>
    </Card>
  );
}

export function TenantsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TenantStatus | "">("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<{ tenant: Tenant; action: "suspend" | "activate" } | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data, isPending, isError, refetch, isFetching } = useTenants({ q, status, page });
  const mutation = useSetTenantStatus();
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const filtered = q !== "" || status !== "";

  async function confirm() {
    if (!target) return;
    const { tenant, action } = target;
    await mutation.mutateAsync({ id: tenant.id, action });
    toast(action === "suspend" ? t.tenants.suspended(tenant.name) : t.tenants.activated(tenant.name));
    setTarget(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {t.tenants.title} <em className="k">{t.tenants.titleWord}</em>
        </h1>
        <Link
          to="/tenants/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover"
        >
          <Plus size={18} aria-hidden /> {t.tenants.new}
        </Link>
      </header>

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-3">
        <Stat label={t.tenants.stats.total} tone="text-ink" />
        <Stat label={t.tenants.stats.active} status="ACTIVE" tone="text-success" />
        <Stat label={t.tenants.stats.suspended} status="SUSPENDED" tone="text-danger" />
      </section>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-64 flex-1">
          <Search size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <Input
            type="search"
            aria-label={t.tenants.search}
            placeholder={t.tenants.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          aria-label={t.tenants.allStatus}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as TenantStatus | "");
            setPage(1);
          }}
          className="w-full sm:w-56"
        >
          <option value="">{t.tenants.allStatus}</option>
          <option value="ACTIVE">{t.tenants.status.ACTIVE}</option>
          <option value="SUSPENDED">{t.tenants.status.SUSPENDED}</option>
          <option value="CANCELLED">{t.tenants.status.CANCELLED}</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {isPending ? (
          <div className="p-8">
            <Spinner />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-start gap-3 p-8">
            <p className="text-sm text-danger">{t.errors.generic}</p>
            <Button onClick={() => void refetch()}>{t.common.retry}</Button>
          </div>
        ) : data.data.length === 0 ? (
          <p className="p-10 text-center text-sm text-ink-2">{filtered ? t.tenants.emptyFiltered : t.tenants.empty}</p>
        ) : (
          <div className={`overflow-x-auto ${isFetching ? "opacity-70" : ""}`}>
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="sticky top-0 border-b border-line bg-surface text-xs uppercase tracking-wider text-ink-2">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">{t.tenants.cols.name}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{t.tenants.cols.plan}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{t.tenants.cols.status}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{t.tenants.cols.ends}</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">{t.tenants.cols.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.data.map((tn) => (
                  <tr key={tn.id} className="h-16">
                    <td className="px-5">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="size-9 shrink-0 rounded-md border border-line"
                          style={{ background: tn.primaryColor }}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{tn.name}</p>
                          <p className="truncate font-mono text-xs text-ink-2">{tn.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3">
                      <span className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-2">
                        {t.tenants.plan[tn.plan]}
                      </span>
                    </td>
                    <td className="px-3">
                      <StatusBadge status={tn.status} />
                    </td>
                    <td className="px-3 tabular-nums text-ink-2">
                      {tn.subscriptionEndsAt ? formatDate(tn.subscriptionEndsAt) : t.tenants.noEnd}
                    </td>
                    <td className="px-5">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/tenants/${tn.id}`}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-semibold hover:border-ink-3"
                        >
                          <Pencil size={15} aria-hidden /> {t.common.edit}
                        </Link>
                        {tn.status === "ACTIVE" ? (
                          <Button onClick={() => setTarget({ tenant: tn, action: "suspend" })}>
                            <PauseCircle size={15} aria-hidden /> {t.tenants.suspend}
                          </Button>
                        ) : tn.status === "SUSPENDED" ? (
                          <Button onClick={() => setTarget({ tenant: tn, action: "activate" })}>
                            <Play size={15} aria-hidden /> {t.tenants.activate}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3">
            <span className="text-sm text-ink-2">{t.tenants.page(page, pages)}</span>
            <div className="flex gap-2">
              <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={16} aria-hidden /> {t.tenants.prev}
              </Button>
              <Button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                {t.tenants.next} <ChevronRight size={16} aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!target}
        danger={target?.action === "suspend"}
        busy={mutation.isPending}
        title={target?.action === "suspend" ? t.tenants.suspendTitle : t.tenants.activateTitle}
        body={
          target ? (target.action === "suspend" ? t.tenants.suspendBody(target.tenant.name) : t.tenants.activateBody(target.tenant.name)) : ""
        }
        confirmLabel={target?.action === "suspend" ? t.tenants.suspend : t.tenants.activate}
        onConfirm={() => void confirm()}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
