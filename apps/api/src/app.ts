import { stripeWebhookRouter } from "./modules/billing/webhook.routes.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { env, isProd } from "./config/env.js";

/** Orígenes de red local (solo desarrollo): http://localhost, 192.168.x.x, 10.x.x.x, 172.16-31.x.x. */
const LAN_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { tenantsRouter } from "./modules/admin/tenants.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { publicRouter } from "./modules/public/brand.routes.js";
import { tenantRouter } from "./modules/tenant/index.js";
import { walletRouter } from "./modules/wallet/wallet.routes.js";
import { terminalRouter } from "./modules/terminal/terminal.routes.js";
import { uploadsRoot } from "./lib/storage.js";

export function createApp(opts: { rateLimit?: boolean } = {}) {
  const useRateLimit = opts.rateLimit ?? true;
  const app = express();

  app.disable("x-powered-by");
  if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);

  app.use(helmet());
  app.use(
    cors({
      // En desarrollo también se acepta la red local: la Wallet web se abre desde el teléfono (http://192.168.x.x:5174).
      origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin) || (!isProd && LAN_ORIGIN.test(origin))),
      credentials: true,
    }),
  );
  app.use("/webhooks", stripeWebhookRouter); // cuerpo crudo: antes de express.json
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  if (useRateLimit) {
    app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false }));
  }

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/auth", authRouter({ rateLimit: useRateLimit }));
  app.use("/admin/tenants", tenantsRouter);
  app.use("/public", publicRouter({ rateLimit: useRateLimit }));
  app.use("/tenant", tenantRouter({ rateLimit: useRateLimit }));
  app.use("/wallet", walletRouter({ rateLimit: useRateLimit }));
  app.use("/terminal", terminalRouter({ rateLimit: useRateLimit }));
  app.use(
    "/uploads",
    express.static(uploadsRoot, {
      index: false,
      dotfiles: "deny",
      immutable: true,
      maxAge: "30d",
      setHeaders: (res) => {
        // El panel y la Wallet (otro origen) muestran estas imágenes
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
