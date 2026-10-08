import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./api/auth";
import type { Me } from "./api/types";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { CajaPage } from "./pages/CajaPage";
import { LoginPage } from "./pages/LoginPage";
import { PlanPage } from "./pages/PlanPage";
import { StaffPage } from "./pages/StaffPage";
import { StoresPage } from "./pages/StoresPage";
import { RewardsPage } from "./pages/RewardsPage";
import { TenantBrandPage } from "./pages/TenantBrandPage";
import { TenantFormPage } from "./pages/TenantFormPage";
import { TenantsPage } from "./pages/TenantsPage";

const expired = (u: Me) => "subscription" in u && u.subscription.expired;
const home = (u: Me) => (u.role === "super_admin" ? "/tenants" : expired(u) ? "/plan" : u.role === "tenant_admin" ? "/rewards" : "/caja");

/** Con la prueba o el plan vencido solo se puede ver la página del plan. */
function RequireSubscription() {
  const { user } = useAuth();
  if (user && expired(user)) return <Navigate to="/plan" replace />;
  return <Outlet />;
}

function Protected({ roles }: { roles?: Me["role"][] }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={home(user)} replace />;
  return <Outlet />;
}

function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? home(user) : "/login"} replace />;
}

export function App() {
  const { loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={loading ? null : <LoginPage />} />
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route element={<Protected roles={["super_admin"]} />}>
            <Route path="/tenants" element={<TenantsPage />} />
            <Route path="/tenants/new" element={<TenantFormPage />} />
            <Route path="/tenants/:id" element={<TenantFormPage />} />
          </Route>
          <Route element={<Protected roles={["tenant_admin", "tenant_staff"]} />}>
            <Route path="/plan" element={<PlanPage />} />
            <Route element={<RequireSubscription />}>
              <Route path="/caja" element={<CajaPage />} />
              <Route path="/rewards" element={<RewardsPage />} />
              <Route path="/stores" element={<StoresPage />} />
            </Route>
          </Route>
          <Route element={<Protected roles={["tenant_admin"]} />}>
            <Route element={<RequireSubscription />}>
              <Route path="/brand" element={<TenantBrandPage />} />
              <Route path="/staff" element={<StaffPage />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
