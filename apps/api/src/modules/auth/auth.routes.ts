import { type CookieOptions, type Response, Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { isProd } from "../../config/env.js";
import { unauthorized } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import * as auth from "./auth.service.js";

const COOKIE = "kairos_rt";
const cookieBase: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  // Panel (Vercel) y API (Render) viven en sitios distintos en producción
  sameSite: isProd ? "none" : "lax",
  path: "/auth",
};

function setRefreshCookie(res: Response, s: auth.Session) {
  res.cookie(COOKIE, s.refreshToken, { ...cookieBase, expires: s.refreshExpiresAt });
}

const loginBody = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});
const tenantLoginBody = loginBody.extend({ tenantSlug: z.string().min(1).max(60) });
const registerBody = z
  .object({
    businessName: z.string().trim().min(2).max(100),
    adminName: z.string().trim().min(2).max(100),
    email: z.email().max(254),
    password: z.string().min(10, "Mínimo 10 caracteres").max(128),
  })
  .strict();

export function authRouter(opts: { rateLimit: boolean }) {
  const r = Router();

  if (opts.rateLimit) {
    r.use(
      ["/super-admin/login", "/tenant/login"],
      rateLimit({
        windowMs: 15 * 60_000,
        limit: 10,
        skipSuccessfulRequests: true,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: { code: "rate_limited", message: "Demasiados intentos. Intenta más tarde" } },
      }),
    );
  }

  // Registro de un negocio nuevo con prueba gratis. Público: se limita por IP.
  if (opts.rateLimit) {
    r.use(
      "/register",
      rateLimit({
        windowMs: 60 * 60_000,
        limit: 5,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: { code: "rate_limited", message: "Demasiados registros desde esta conexión. Intenta más tarde" } },
      }),
    );
  }

  r.post("/register", async (req, res) => {
    const body = registerBody.parse(req.body);
    const result = await auth.registerTenant(body, req.ip);
    setRefreshCookie(res, result.session);
    res.status(201).json({
      accessToken: result.session.accessToken,
      expiresIn: result.session.expiresIn,
      user: result.user,
      tenant: result.tenant,
      trialEndsAt: result.trialEndsAt,
    });
  });

  r.post("/super-admin/login", async (req, res) => {
    const { email, password } = loginBody.parse(req.body);
    const { session, user } = await auth.loginSuperAdmin(email, password);
    setRefreshCookie(res, session);
    res.json({ accessToken: session.accessToken, expiresIn: session.expiresIn, user });
  });

  r.post("/tenant/login", async (req, res) => {
    const { tenantSlug, email, password } = tenantLoginBody.parse(req.body);
    const { session, user } = await auth.loginTenantUser(tenantSlug, email, password);
    setRefreshCookie(res, session);
    res.json({ accessToken: session.accessToken, expiresIn: session.expiresIn, user });
  });

  r.post("/refresh", async (req, res) => {
    const token = req.cookies?.[COOKIE];
    if (!token) throw unauthorized("Sin sesión");
    try {
      const session = await auth.refreshSession(token);
      setRefreshCookie(res, session);
      res.json({ accessToken: session.accessToken, expiresIn: session.expiresIn });
    } catch (e) {
      res.clearCookie(COOKIE, cookieBase);
      throw e;
    }
  });

  r.post("/logout", async (req, res) => {
    await auth.logout(req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, cookieBase);
    res.status(204).end();
  });

  r.get("/me", requireAuth, async (req, res) => {
    res.json(await auth.getProfile(req.auth!.sub, req.auth!.role));
  });

  return r;
}
