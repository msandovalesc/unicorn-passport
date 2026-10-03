import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { db } from "@/lib/db";
import { emailFromClaims, isAdminFromClaims, rejectReason, type EntraClaims } from "@/lib/authRules";
import { allowedDomains, devLoginEnabled, entraConfigured, env } from "@/lib/env";

const adminCfg = { appRole: env.ADMIN_APP_ROLE, groupId: env.ADMIN_GROUP_ID || undefined };

const providers: NextAuthConfig["providers"] = [];

if (entraConfigured) {
  providers.push(
    MicrosoftEntraID({
      clientId: env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      // Single-tenant issuer: only accounts in the Unosquare directory can sign in.
      issuer: `https://login.microsoftonline.com/${env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`,
      authorization: { params: { scope: "openid profile email", prompt: "select_account" } },
    }),
  );
}

if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { email: { label: "Email" } },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase();
        const employee = await db.employee.findUnique({ where: { email } });
        if (!employee) return null;
        const devAdmins = (process.env.DEV_ADMIN_EMAILS ?? "").toLowerCase().split(",").map((s) => s.trim());
        return { id: employee.id, name: employee.name, email: employee.email, isAdmin: devAdmins.includes(email) };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: { signIn: "/signin", error: "/signin" },
  // Employees stay signed in on their phone so scanning an event QR stamps instantly.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 60 },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "microsoft-entra-id") return true;
      const reason = rejectReason(profile as EntraClaims, { tenantId: env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID, allowedDomains });
      return reason ? `/signin?error=${reason}` : true;
    },

    async jwt({ token, account, profile, user }) {
      if (account?.provider === "microsoft-entra-id" && profile) {
        const p = profile as EntraClaims;
        const email = emailFromClaims(p);
        // Self-service enrollment: the employee record is created (or refreshed) on first login.
        const employee = await db.employee.upsert({
          where: { m365ObjectId: p.oid! },
          create: { m365ObjectId: p.oid!, email, name: p.name ?? email },
          update: { email, name: p.name ?? email, lastSeenAt: new Date() },
        });
        token.employeeId = employee.id;
        token.isAdmin = isAdminFromClaims(p, adminCfg);
        token.adminCheckedAt = Date.now();
      } else if (account?.provider === "dev" && user) {
        token.employeeId = user.id!;
        token.isAdmin = Boolean((user as { isAdmin?: boolean }).isAdmin);
        token.adminCheckedAt = Date.now();
      }
      return token;
    },

    async session({ session, token }) {
      session.employeeId = token.employeeId as string;
      session.isAdmin = Boolean(token.isAdmin);
      session.adminCheckedAt = Number(token.adminCheckedAt ?? 0);
      return session;
    },
  },
});
