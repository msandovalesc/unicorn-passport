/** Pure sign-in rules, kept separate from the Auth.js setup so they can be unit-tested. */

export type EntraClaims = {
  oid?: string;
  tid?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  roles?: string[];
  groups?: string[];
};

export function emailFromClaims(p: EntraClaims): string {
  return (p.email ?? p.preferred_username ?? "").trim().toLowerCase();
}

export function isAllowedEmail(email: string | undefined | null, allowedDomains: string[]): boolean {
  if (!email) return false;
  const parts = email.toLowerCase().split("@");
  return parts.length === 2 && parts[0].length > 0 && allowedDomains.includes(parts[1]);
}

/** Why an Entra sign-in is rejected, or null if it is allowed. */
export function rejectReason(p: EntraClaims, cfg: { tenantId?: string; allowedDomains: string[] }): "tenant" | "domain" | null {
  if (!cfg.tenantId || p.tid !== cfg.tenantId) return "tenant";
  if (!p.oid || !isAllowedEmail(emailFromClaims(p), cfg.allowedDomains)) return "domain";
  return null;
}

/** Admin = assigned the app role (recommended), or member of the admin group via the groups claim. */
export function isAdminFromClaims(p: Pick<EntraClaims, "roles" | "groups">, cfg: { appRole: string; groupId?: string }): boolean {
  if (p.roles?.includes(cfg.appRole)) return true;
  if (cfg.groupId && p.groups?.includes(cfg.groupId)) return true;
  return false;
}
