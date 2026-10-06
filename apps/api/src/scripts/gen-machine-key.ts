import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Genera el par de llaves de una máquina Arcade (ES256).
// La PRIVADA va a la máquina (archivo con permisos restringidos); la PÚBLICA se pega en el panel del negocio.
// Uso: pnpm --filter @kairos/api gen:machine-key <nombre>
const name = (process.argv[2] ?? "machine").replace(/[^a-z0-9-_]/gi, "");
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const dir = path.resolve("secrets");
mkdirSync(dir, { recursive: true });
const priv = path.join(dir, `${name}.private.pem`);
const pub = path.join(dir, `${name}.public.pem`);
writeFileSync(priv, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
writeFileSync(pub, publicKey.export({ type: "spki", format: "pem" }));
console.log(`Privada (NO compartir): ${priv}\nPública (pegar en el panel): ${pub}\n`);
console.log(publicKey.export({ type: "spki", format: "pem" }).toString());
