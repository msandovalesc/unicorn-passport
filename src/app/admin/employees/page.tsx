import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { cardPosition } from "@/lib/progress";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Employees" };

const PAGE = 50;

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; track?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.EmployeeWhereInput = {
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { location: { contains: q, mode: "insensitive" } }] } : {}),
    ...(sp.track === "none" ? { trackId: null } : sp.track ? { track: { slug: sp.track } } : {}),
  };

  const [total, employees, tracks] = await Promise.all([
    db.employee.count({ where }),
    db.employee.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: {
        track: { select: { name: true } },
        passes: { select: { platform: true } },
        _count: { select: { stamps: true } },
        rewards: { where: { redeemedAt: null }, select: { id: true } },
      },
    }),
    db.rewardTrack.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), ...(sp.track ? { track: sp.track } : {}), page: String(p) })}`;

  return (
    <div className="stack-lg">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 32 }}>
          <strong>Employees</strong> <span className="muted" style={{ fontSize: 20 }}>{total}</span>
        </h1>
        <a href="/api/admin/reports/employees" className="btn btn-ghost">
          Download CSV
        </a>
      </div>

      <form method="get" className="row filters">
        <input className="input" style={{ marginTop: 0, maxWidth: 360 }} name="q" defaultValue={q} placeholder="Search name, email or location" aria-label="Search employees" />
        <select className="input" style={{ marginTop: 0, maxWidth: 200 }} name="track" defaultValue={sp.track ?? ""} aria-label="Track">
          <option value="">All tracks</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.name}
            </option>
          ))}
          <option value="none">Not enrolled</option>
        </select>
        <button className="btn btn-ghost" type="submit">
          Filter
        </button>
      </form>

      <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Location</th>
              <th>Track</th>
              <th style={{ textAlign: "right" }}>Stamps</th>
              <th>Card</th>
              <th>Wallet</th>
              <th>Rewards</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const { cardNumber, stampsOnCard } = cardPosition(e._count.stamps);
              const wallets = [...new Set(e.passes.map((p) => p.platform).filter((p) => p !== "web"))];
              return (
                <tr key={e.id}>
                  <td>
                    <Link href={`/admin/employees/${e.id}`}>
                      <strong>{e.name}</strong>
                    </Link>
                    <div className="small muted">{e.email}</div>
                  </td>
                  <td className="small">{e.location ?? "–"}</td>
                  <td className="small">{e.track?.name ?? <span className="muted">Not enrolled</span>}</td>
                  <td style={{ textAlign: "right" }}>{e._count.stamps}</td>
                  <td className="small">
                    #{cardNumber} · {stampsOnCard}/10
                  </td>
                  <td className="small">{wallets.length ? wallets.map((w) => (w === "apple" ? "Apple" : "Google")).join(", ") : <span className="muted">Web only</span>}</td>
                  <td>{e.rewards.length > 0 ? <span className="badge badge-open">{e.rewards.length} to hand out</span> : <span className="muted small">–</span>}</td>
                </tr>
              );
            })}
            {employees.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No employees match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="row" aria-label="Pages">
          {page > 1 && <Link href={qs(page - 1)}>← Previous</Link>}
          <span className="muted small">
            Page {page} of {pages}
          </span>
          {page < pages && <Link href={qs(page + 1)}>Next →</Link>}
        </nav>
      )}
    </div>
  );
}
