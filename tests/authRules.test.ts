import { describe, expect, it } from "vitest";
import { isAdminFromClaims, isAllowedEmail, rejectReason } from "@/lib/authRules";

const cfg = { tenantId: "uno-tenant", allowedDomains: ["unosquare.com"] };

describe("isAllowedEmail", () => {
  it.each([
    ["ana@unosquare.com", true],
    ["Ana@UNOSQUARE.com", true],
    ["ana@gmail.com", false],
    ["ana@unosquare.com.evil.io", false],
    ["ana@sub.unosquare.com", false],
    ["@unosquare.com", false],
    ["", false],
  ])("%s → %s", (email, ok) => {
    expect(isAllowedEmail(email, cfg.allowedDomains)).toBe(ok);
  });
});

describe("rejectReason", () => {
  it("accepts a Unosquare account from the Unosquare tenant", () => {
    expect(rejectReason({ oid: "1", tid: "uno-tenant", email: "ana@unosquare.com" }, cfg)).toBeNull();
  });
  it("falls back to preferred_username when email is missing", () => {
    expect(rejectReason({ oid: "1", tid: "uno-tenant", preferred_username: "ana@unosquare.com" }, cfg)).toBeNull();
  });
  it("rejects other tenants, even with a matching email", () => {
    expect(rejectReason({ oid: "1", tid: "other", email: "ana@unosquare.com" }, cfg)).toBe("tenant");
  });
  it("rejects guest/external emails inside the tenant", () => {
    expect(rejectReason({ oid: "1", tid: "uno-tenant", email: "vendor@contoso.com" }, cfg)).toBe("domain");
  });
  it("rejects when the tenant is not configured", () => {
    expect(rejectReason({ oid: "1", tid: "uno-tenant", email: "ana@unosquare.com" }, { ...cfg, tenantId: undefined })).toBe("tenant");
  });
});

describe("isAdminFromClaims", () => {
  const admin = { appRole: "Passport.Admin", groupId: "grp-1" };
  it("grants admin via app role", () => expect(isAdminFromClaims({ roles: ["Passport.Admin"] }, admin)).toBe(true));
  it("grants admin via group claim", () => expect(isAdminFromClaims({ groups: ["x", "grp-1"] }, admin)).toBe(true));
  it("denies everyone else", () => expect(isAdminFromClaims({ roles: ["Other"], groups: ["x"] }, admin)).toBe(false));
  it("ignores groups when no group is configured", () =>
    expect(isAdminFromClaims({ groups: ["grp-1"] }, { appRole: "Passport.Admin" })).toBe(false));
});
