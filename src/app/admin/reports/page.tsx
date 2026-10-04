import type { Metadata } from "next";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const [stamps, rewards, employees] = await Promise.all([db.stamp.count(), db.reward.count(), db.employee.count()]);
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600_000).toISOString().slice(0, 10);

  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <h1 style={{ fontSize: 32 }}>
          <strong>Reports</strong>
        </h1>
        <p className="muted">CSV files open in Excel or Google Sheets. Times are in UTC.</p>
      </div>

      <div className="grid-3">
        <ReportCard
          title="Attendance"
          description={`Every check-in: event, employee, time and method (QR, code or manual). ${stamps.toLocaleString()} rows in total.`}
          href="/api/admin/reports/attendance"
          dated
          today={today}
          monthAgo={monthAgo}
        />
        <ReportCard
          title="Rewards"
          description={`Unlocked and redeemed rewards, with who handed them out. ${rewards.toLocaleString()} rows in total.`}
          href="/api/admin/reports/redemptions"
          dated
          today={today}
          monthAgo={monthAgo}
        />
        <ReportCard
          title="Employees"
          description={`One row per person: track, stamps, current card, wallet and rewards. ${employees.toLocaleString()} rows.`}
          href="/api/admin/reports/employees"
          today={today}
          monthAgo={monthAgo}
        />
      </div>
    </div>
  );
}

function ReportCard({ title, description, href, dated, today, monthAgo }: { title: string; description: string; href: string; dated?: boolean; today: string; monthAgo: string }) {
  return (
    <section className="panel stack-sm">
      <p className="eyebrow">{title}</p>
      <p className="small">{description}</p>
      <a href={href} className="btn btn-primary btn-sm">
        Download all
      </a>
      {dated && (
        <form action={href} method="get" className="stack-sm">
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <label className="field small" style={{ flex: 1 }}>
              From
              <input className="input input-sm" type="date" name="from" defaultValue={monthAgo} />
            </label>
            <label className="field small" style={{ flex: 1 }}>
              To
              <input className="input input-sm" type="date" name="to" defaultValue={today} />
            </label>
          </div>
          <button className="btn btn-ghost btn-sm" type="submit">
            Download date range
          </button>
        </form>
      )}
    </section>
  );
}
