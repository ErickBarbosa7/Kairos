import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import "dotenv/config";

/** Las pruebas usan la base `kairos_test`, nunca la de desarrollo. */
export default function setup() {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL no definido (apps/api/.env)");
  const url = new URL(base);
  url.pathname = "/kairos_test";
  process.env.DATABASE_URL = url.toString();
  process.env.UPLOADS_DIR = path.join(tmpdir(), "kairos-test-uploads");
  process.env.JWT_ACCESS_SECRET ??= "test-secret-test-secret-test-secret-123456";
  execSync("pnpm exec prisma migrate deploy", { stdio: "inherit" });
}
