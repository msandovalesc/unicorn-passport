import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  PROGRAM_NAME: z.string().default("Unicorn Passport"),
  DATABASE_URL: z.string().min(1),
  ALLOWED_EMAIL_DOMAINS: z.string().default("unosquare.com"),
  ADMIN_APP_ROLE: z.string().default("Passport.Admin"),
  ADMIN_GROUP_ID: z.string().optional(),
  DEV_LOGIN: z.string().optional(),
  AUTH_MICROSOFT_ENTRA_ID_ID: z.string().optional(),
  AUTH_MICROSOFT_ENTRA_ID_SECRET: z.string().optional(),
  AUTH_MICROSOFT_ENTRA_ID_TENANT_ID: z.string().optional(),
});

export const env = schema.parse(process.env);

export const allowedDomains = env.ALLOWED_EMAIL_DOMAINS.split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

/** Dev login is only ever available outside production. */
export const devLoginEnabled = env.NODE_ENV !== "production" && env.DEV_LOGIN === "true";

export const entraConfigured = Boolean(
  env.AUTH_MICROSOFT_ENTRA_ID_ID && env.AUTH_MICROSOFT_ENTRA_ID_SECRET && env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID,
);
