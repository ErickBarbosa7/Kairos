import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { PlansCatalog, SubscriptionDetail } from "./types";

/** Precios y límites de los planes. Son públicos y casi no cambian. */
export const usePlans = () =>
  useQuery({ queryKey: ["plans"], queryFn: () => api<PlansCatalog>("/public/plans", { auth: false }), staleTime: 10 * 60_000 });

/** Estado del plan del negocio con su uso. Solo para usuarios del negocio con sesión. */
export const useSubscriptionDetail = () =>
  useQuery({ queryKey: ["subscription"], queryFn: () => api<SubscriptionDetail>("/tenant/subscription") });
