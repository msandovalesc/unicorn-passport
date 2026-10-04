import Link from "next/link";
import { UnicornOutline } from "@/components/UnicornOutline";

export default function NotFound() {
  return (
    <main className="screen surface-light">
      <div className="container stack-lg" style={{ textAlign: "center", paddingTop: 96 }}>
        <UnicornOutline size={140} color="var(--blue-500)" className="outline-illustration" />
        <section className="stack-sm">
          <p className="eyebrow">404</p>
          <h1 style={{ fontSize: 32 }}>
            This unicorn <strong>wandered off</strong>
          </h1>
          <p className="muted">The page you&apos;re looking for doesn&apos;t exist.</p>
        </section>
        <Link href="/card" className="btn btn-primary btn-block">
          Back to my card
        </Link>
      </div>
    </main>
  );
}
