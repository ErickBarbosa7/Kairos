import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";

const server = createApp().listen(env.PORT, () => {
  console.log(`Kairos API en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
