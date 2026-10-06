/**
 * Unicorn Passport wordmark (designed in Claude Design). "dark" = white wordmark for dark/blue
 * backgrounds, "light" = blue wordmark for light backgrounds. Source: assets/brand/unicorn-passport.
 */
export function ProgramLogo({ tone = "dark", width = 160, className }: { tone?: "dark" | "light"; width?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={`/brand/unicorn-passport-${tone}.png`}
      alt="Unicorn Passport"
      width={width}
      height={Math.round((width * 848) / 2704)}
      className={className}
      style={{ height: "auto" }}
    />
  );
}
