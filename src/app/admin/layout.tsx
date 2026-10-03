import Link from "next/link";
import { Logo } from "@/components/Logo";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { employee } = await requireAdmin("/admin");
  return (
    <div style={{ minHeight: "100dvh" }}>
      <header className="surface-dark">
        <div className="container container-wide" style={{ paddingBottom: 16, paddingTop: 16 }}>
          <div className="topbar">
            <div className="row">
              <Logo />
              <span className="eyebrow">Passport admin</span>
            </div>
            <span className="small muted">{employee.name}</span>
          </div>
          <nav className="admin-nav" style={{ marginTop: 16 }} aria-label="Admin">
            <Link href="/admin">Overview</Link>
            <Link href="/admin/events">Events</Link>
            <Link href="/admin/employees">Employees</Link>
            <Link href="/admin/rewards">Rewards</Link>
            <Link href="/admin/tiers">Tiers</Link>
            <Link href="/admin/reports">Reports</Link>
          </nav>
        </div>
      </header>
      <main className="container container-wide">{children}</main>
    </div>
  );
}
