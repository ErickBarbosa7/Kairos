export type TenantStatus = "ACTIVE" | "SUSPENDED" | "CANCELLED";
export type Plan = "TRIAL" | "BASIC" | "PRO";
export type ThemeMode = "LIGHT" | "DARK" | "AUTO";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: Plan;
  subscriptionEndsAt: string | null;
  /** Plan de pago que el negocio pidió al terminar su prueba; el Super Admin lo activa. */
  requestedPlan: Plan | null;
  planRequestedAt: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  themeMode: ThemeMode;
  scorePerPoint: number;
  maxPointsPerGame: number;
  maxGamesPerDay: number;
  createdAt: string;
}

export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SuperAdminMe {
  id: string;
  email: string;
  name: string;
  role: "super_admin";
}

export interface TenantBrand {
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  themeMode: ThemeMode;
}

/** Precios y límites de los planes, tal como los publica la API (`/public/plans`). */
export interface PlansCatalog {
  currency: string;
  period: string;
  trialDays: number;
  plans: { key: Plan; priceMonthly: number; limits: { stores: number; machines: number } }[];
}

/** Subscription con lo que lleva usado el negocio de cada límite. */
export interface SubscriptionDetail extends Subscription {
  planRequestedAt: string | null;
  limits: { stores: number; machines: number };
  usage: { stores: number; machines: number };
}

/** Estado de la prueba o del plan de un negocio. `endsAt` y `daysLeft` son null si no vence. */
export interface Subscription {
  plan: Plan;
  endsAt: string | null;
  daysLeft: number | null;
  expired: boolean;
  onTrial: boolean;
  requestedPlan: Plan | null;
}

export interface TenantMe {
  id: string;
  email: string;
  name: string;
  role: "tenant_admin" | "tenant_staff";
  storeId: string | null;
  tenant: TenantBrand & { id: string };
  subscription: Subscription;
}

export type Me = SuperAdminMe | TenantMe;

export interface Reward {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  pointsCost: number;
  stock: number | null;
  isActive: boolean;
}

export type CouponStatus = "PENDING" | "REDEEMED" | "EXPIRED" | "CANCELLED";

export interface Coupon {
  id: string;
  code: string;
  status: CouponStatus;
  rewardTitle: string;
  pointsCost: number;
  expiresAt: string;
  redeemedAt: string | null;
  redeemedBy?: string | null;
}

export interface Store {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
}

export interface Machine {
  id: string;
  storeId: string;
  label: string;
  keyAlgorithm: "ES256" | "EDDSA";
  authMode: "DEVICE_KEY" | "WEB_SESSION";
  status: "ACTIVE" | "REVOKED";
  lastSeenAt: string | null;
  revokedAt: string | null;
}

export interface Staff {
  id: string;
  email: string;
  name: string;
  role: "TENANT_ADMIN" | "TENANT_STAFF";
  storeId: string | null;
  isActive: boolean;
}
