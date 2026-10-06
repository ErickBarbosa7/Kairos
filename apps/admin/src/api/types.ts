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

export interface TenantMe {
  id: string;
  email: string;
  name: string;
  role: "tenant_admin" | "tenant_staff";
  storeId: string | null;
  tenant: TenantBrand & { id: string };
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
