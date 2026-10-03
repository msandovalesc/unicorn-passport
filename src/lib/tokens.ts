import { randomBytes } from "node:crypto";

/** URL-safe random token. 24 bytes → 32 chars. */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
