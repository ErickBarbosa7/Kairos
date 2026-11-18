import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Campaign, CustomerDetail, CustomerList, Coupon, Machine, Retention, Reward, Roi, Staff, WeeklyReport, Store, TenantBrand, TenantEconomy, ThemeMode } from "./types";

export const useBrand = () => useQuery({ queryKey: ["brand"], queryFn: () => api<TenantBrand>("/tenant/brand") });

export interface BrandInput {
  primaryColor: string;
  secondaryColor: string | null;
  themeMode: ThemeMode;
  logoUrl: string | null;
}

export function useUpdateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<BrandInput>) => api<TenantBrand>("/tenant/brand", { method: "PATCH", body }),
    onSuccess: (data) => qc.setQueryData(["brand"], data),
  });
}

export const useEconomy = () => useQuery({ queryKey: ["economy"], queryFn: () => api<TenantEconomy>("/tenant/economy") });

export function useUpdateEconomy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<TenantEconomy>) => api<TenantEconomy>("/tenant/economy", { method: "PATCH", body }),
    onSuccess: (data) => qc.setQueryData(["economy"], data),
  });
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  return (await api<{ url: string }>("/tenant/uploads", { method: "POST", body: form })).url;
}

export const useRewards = () =>
  useQuery({ queryKey: ["rewards"], queryFn: () => api<{ data: Reward[] }>("/tenant/rewards").then((r) => r.data) });

export type RewardInput = Omit<Reward, "id">;

export function useSaveReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<RewardInput> & { id?: string }) =>
      id
        ? api<Reward>(`/tenant/rewards/${id}`, { method: "PATCH", body })
        : api<Reward>("/tenant/rewards", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rewards"] }),
  });
}

export function useDeleteReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/tenant/rewards/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rewards"] }),
  });
}

export const lookupCoupon = (code: string) => api<Coupon>(`/tenant/coupons/by-code/${encodeURIComponent(code)}`);

export function useRedeemCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api<Coupon>(`/tenant/coupons/by-code/${encodeURIComponent(code)}/redeem`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });
}

export const useRecentRedeemed = () =>
  useQuery({
    queryKey: ["coupons", "redeemed"],
    queryFn: () => api<{ data: Coupon[] }>("/tenant/coupons?status=REDEEMED&limit=8").then((r) => r.data),
  });

// ───────── Sucursales, máquinas y personal ─────────

export const useStores = () =>
  useQuery({ queryKey: ["stores"], queryFn: () => api<{ data: Store[] }>("/tenant/stores").then((r) => r.data) });

export function useSaveStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Store> & { id?: string }) =>
      id ? api<Store>(`/tenant/stores/${id}`, { method: "PATCH", body }) : api<Store>("/tenant/stores", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stores"] }),
  });
}

export const useMachines = () =>
  useQuery({ queryKey: ["machines"], queryFn: () => api<{ data: Machine[] }>("/tenant/machines").then((r) => r.data) });

export function useCreateMachine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { storeId: string; label: string; keyAlgorithm: "ES256" | "EDDSA"; publicKey: string }) =>
      api<Machine>("/tenant/machines", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["machines"] }),
  });
}

export function useApproveTerminalPairing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { code: string; storeId: string; label: string }) =>
      api<Machine>(`/tenant/terminal-pairings/${encodeURIComponent(body.code)}/approve`, { method: "POST", body: { storeId: body.storeId, label: body.label } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["machines"] }),
  });
}

export function useRevokeMachine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<Machine>(`/tenant/machines/${id}/revoke`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["machines"] }),
  });
}

export const useStaff = () =>
  useQuery({ queryKey: ["staff"], queryFn: () => api<{ data: Staff[] }>("/tenant/staff").then((r) => r.data) });

export function useSaveStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string; name?: string; email?: string; password?: string; storeId?: string | null; isActive?: boolean }) =>
      id ? api<Staff>(`/tenant/staff/${id}`, { method: "PATCH", body }) : api<Staff>("/tenant/staff", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });
}

export const useRetention = () => useQuery({ queryKey: ["retention"], queryFn: () => api<Retention>("/tenant/analytics/retention") });
/** El ROI no está en todos los planes: un 403 se muestra como invitación a subir de plan, no como error. */
export const useRoi = () => useQuery({ queryKey: ["roi"], queryFn: () => api<Roi>("/tenant/analytics/roi"), retry: false });

export const useWeekly = () =>
  useQuery({ queryKey: ["weekly"], queryFn: () => api<WeeklyReport | null>("/tenant/analytics/weekly"), retry: false });

export function useRefreshWeekly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<WeeklyReport>("/tenant/analytics/weekly/refresh", { method: "POST" }),
    onSuccess: (data) => qc.setQueryData(["weekly"], data),
  });
}

export const useCampaigns = () =>
  useQuery({ queryKey: ["campaigns"], queryFn: () => api<{ data: Campaign[]; plan: "TRIAL" | "BASIC" | "PRO" }>("/tenant/campaigns") });

export type CampaignInput = Omit<Campaign, "id">;

export function useSaveCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CampaignInput> & { id?: string }) =>
      api<Campaign>(id ? `/tenant/campaigns/${id}` : "/tenant/campaigns", { method: id ? "PATCH" : "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/tenant/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

export const useCustomers = (q: string, page: number) =>
  useQuery({
    queryKey: ["customers", q, page],
    queryFn: () => api<CustomerList>(`/tenant/customers?page=${page}&limit=25${q ? `&q=${encodeURIComponent(q)}` : ""}`),
    placeholderData: (prev) => prev,
  });

export const useCustomer = (id: string | null) =>
  useQuery({ queryKey: ["customer", id], queryFn: () => api<CustomerDetail>(`/tenant/customers/${id}`), enabled: !!id });

export function useAdjustPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; points: number; note: string }) =>
      api(`/tenant/customers/${id}/adjust`, { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer"] });
    },
  });
}
