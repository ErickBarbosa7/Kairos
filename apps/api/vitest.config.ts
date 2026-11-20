import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 15_000,
    // Las pruebas canjean premios al instante; la que prueba el desbloqueo lo cambia a mano.
    env: { PRIZE_UNLOCK_HOURS: "0", STRIPE_SECRET_KEY: "sk_test_dummy", STRIPE_WEBHOOK_SECRET: "whsec_test" },
  },
});
