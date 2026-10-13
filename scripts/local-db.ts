/**
 * Local PostgreSQL for development, no Docker needed (uses the embedded-postgres binaries).
 * Data lives outside the repo (and outside OneDrive) in your user profile.
 * Run: npm run db:local   (leave it running; Ctrl+C to stop)
 */
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const base = process.env.LOCALAPPDATA ?? path.join(os.homedir(), ".local", "share");
const dataDir = path.join(base, "unicorn-passport", "pgdata");
const port = Number(process.env.LOCAL_PG_PORT ?? 5433);

/** After a reboot or crash Postgres leaves postmaster.pid behind and refuses to start; remove it if that process is gone. */
function clearStaleLock() {
  const lock = path.join(dataDir, "postmaster.pid");
  if (!fs.existsSync(lock)) return;
  const pid = Number(fs.readFileSync(lock, "utf8").split(/\r?\n/)[0]);
  let alive = false;
  try {
    process.kill(pid, 0);
    alive = true;
  } catch {}
  if (!alive) {
    fs.rmSync(lock);
    console.log("Removed a stale Postgres lock file from the last shutdown.");
  }
}

async function main() {
  const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: "passport", password: "passport", port, persistent: true });
  const fresh = !fs.existsSync(path.join(dataDir, "PG_VERSION"));
  if (fresh) {
    fs.mkdirSync(path.dirname(dataDir), { recursive: true });
    await pg.initialise();
  }
  clearStaleLock();
  await pg.start();
  if (fresh) {
    await pg.createDatabase("unicorn_passport");
    await pg.createDatabase("unicorn_passport_test");
  }
  console.log(`Postgres running on localhost:${port} (data: ${dataDir}). Ctrl+C to stop.`);
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
