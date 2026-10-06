import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { ProgramLogo } from "@/components/ProgramLogo";
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
              <Link href="/admin" aria-label="Admin overview">
                <ProgramLogo tone="dark" width={120} />
              </Link>
              <span className="eyebrow">Admin</span>
            </div>
            <span className="small muted">{employee.name}</span>
          </div>
          <AdminNav />
        </div>
      </header>
      <main className="container container-wide">{children}</main>
    </div>
  );
}
