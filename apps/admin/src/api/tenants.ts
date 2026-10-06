import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Page, Plan, Tenant, TenantStatus, ThemeMode } from "./types";

export interface ListParams {
  q?: string;
  status?: TenantStatus | "";
  page: number;
  limit?: number;
}

const qs = (p: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== "") s.set(k, String(v));
  return s.toString();
};

export const useTenants = (p: ListParams) =>
  useQuery({
    queryKey: ["tenants", p],
    queryFn: () => api<Page<Tenant>>(`/admin/tenants?${qs({ ...p, limit: p.limit ?? 10 })}`),
    placeholderData: keepPreviousData,
  });

export const useTenantCount = (status?: TenantStatus) =>
  useQuery({
    queryKey: ["tenant-count", status ?? "all"],
    queryFn: () => api<Page<Tenant>>(`/admin/tenants?${qs({ status, limit: 1 })}`).then((r) => r.total),
  });

export const useTenant = (id: string | undefined) =>
  useQuery({ queryKey: ["tenant", id], queryFn: () => api<Tenant>(`/admin/tenants/${id}`), enabled: !!id });

export interface CreateTenantInput {
  name: string;
  slug: string;
  plan: Plan;
  subscriptionEndsAt: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  themeMode: ThemeMode;
  admin?: { email: string; name: string; password: string };
}

export type UpdateTenantInput = Partial<
  Pick<
    Tenant,
    | "name"
    | "plan"
    | "subscriptionEndsAt"
    | "primaryColor"
    | "secondaryColor"
    | "themeMode"
    | "scorePerPoint"
    | "maxPointsPerGame"
    | "maxGamesPerDay"
  >
>;

function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ["tenants"] }), qc.invalidateQueries({ queryKey: ["tenant"] }), qc.invalidateQueries({ queryKey: ["tenant-count"] })]);
}

export function useCreateTenant() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: CreateTenantInput) => api<Tenant>("/admin/tenants", { method: "POST", body }),
    onSuccess: invalidate,
  });
}

export function useUpdateTenant(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: UpdateTenantInput) => api<Tenant>(`/admin/tenants/${id}`, { method: "PATCH", body }),
    onSuccess: invalidate,
  });
}

export function useSetTenantStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "suspend" | "activate" }) =>
      api<Tenant>(`/admin/tenants/${id}/${action}`, { method: "POST" }),
    onSuccess: invalidate,
  });
}
