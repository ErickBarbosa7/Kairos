import { hash, verify } from "@node-rs/argon2";

export const hashPassword = (plain: string) => hash(plain);

// Hash de relleno: se verifica cuando el usuario no existe para igualar tiempos de respuesta.
const dummyHash = await hash("kairos-dummy-password");

export async function verifyPassword(stored: string | null | undefined, plain: string): Promise<boolean> {
  try {
    const ok = await verify(stored ?? dummyHash, plain);
    return stored ? ok : false;
  } catch {
    return false;
  }
}
