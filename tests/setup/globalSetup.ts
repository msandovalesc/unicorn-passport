import { execSync } from "node:child_process";
import net from "node:net";

/** Migrates the test database if it's reachable; DB tests skip themselves otherwise. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  const { hostname, port } = new URL(url);
  const reachable = await new Promise<boolean>((resolve) => {
    const s = net.connect(Number(port || 5432), hostname);
    s.setTimeout(1500);
    s.on("connect", () => (s.destroy(), resolve(true)));
    s.on("error", () => resolve(false));
    s.on("timeout", () => (s.destroy(), resolve(false)));
  });
  if (!reachable) return;
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
  process.env.__TEST_DB_OK = "1";
}
