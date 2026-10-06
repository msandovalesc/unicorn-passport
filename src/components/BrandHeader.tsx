import Link from "next/link";
import { Logo } from "./Logo";
import { ProgramLogo } from "./ProgramLogo";

/** Employee-screen header: the program logo leads, the unosquare wordmark signs it. */
export function BrandHeader({ tone = "dark", children }: { tone?: "dark" | "light"; children?: React.ReactNode }) {
  return (
    <header className="brand-header">
      <Link href="/" aria-label="Unicorn Passport home">
        <ProgramLogo tone={tone} width={150} />
      </Link>
      <div className="row" style={{ gap: 12 }}>
        {children}
        <Logo tone={tone === "dark" ? "white" : "dark"} className="logo-sm" />
      </div>
    </header>
  );
}
