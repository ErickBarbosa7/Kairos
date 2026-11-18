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
  /** El negocio cuenta con la cuenta administradora que le permite acceder al panel. */
  hasAdmin: boolean;
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

/** Parámetros de puntos que el negocio puede ajustar desde su panel. */
export interface TenantEconomy {
  scorePerPoint: number;
  maxPointsPerGame: number;
  maxGamesPerDay: number;
  avgTicket: number | null;
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
  unitCost: number | null;
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

export interface Retention {
  from: string;
  to: string;
  newCustomers: number;
  returningCustomers: number;
  return7: number | null;
  return30: number | null;
  visitsByDay: { date: string; visits: number }[];
  visitsByHour: { hour: number; visits: number }[];
}

export interface Roi {
  from: string;
  to: string;
  programCost: number;
  attributedRevenue: number;
  roi: number | null;
  missing: ("avgTicket" | "unitCost")[];
  estimated: true;
}

export type CampaignType = "MULTIPLIER" | "FIRST_VISIT_BONUS" | "COMEBACK_UNLOCK";

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  isActive: boolean;
  multiplierPct: number | null;
  bonusPoints: number | null;
  unlockHours: number | null;
  startsAt: string | null;
  endsAt: string | null;
  weekdays: number[];
  startHour: number | null;
  endHour: number | null;
}

export interface WeeklyReport {
  weekStart: string;
  headline: string;
  recommendation: string;
  metrics: { weekVisits: number; newCustomers: number; returningCustomers: number; return7: number | null; roi: number | null };
}

export interface CustomerConsumer {
  id: string;
  displayName: string | null;
  email: string | null;
  isGuest: boolean;
  createdAt: string;
}
export interface CustomerRow {
  id: string;
  balance: number;
  lifetimeEarned: number;
  lastActivityAt: string;
  joinedAt: string;
  consumer: CustomerConsumer;
}
export interface CustomerList {
  total: number;
  page: number;
  limit: number;
  data: CustomerRow[];
}
export interface CustomerMovement {
  id: string;
  type: "EARN" | "REDEEM" | "REFUND" | "ADJUST";
  points: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
}
export interface CustomerDetail extends CustomerRow {
  coupons: Partial<Record<"PENDING" | "REDEEMED" | "EXPIRED" | "CANCELLED", number>>;
  transactions: CustomerMovement[];
}
