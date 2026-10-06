import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Coupon, Machine, Reward, Staff, Store, TenantBrand, ThemeMode } from "./types";

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
