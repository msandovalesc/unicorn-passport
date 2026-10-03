/* Official unosquare imagotype (from the Visual Identity System). Never in yellow. */
export function Logo({ tone = "white", className = "logo" }: { tone?: "white" | "dark"; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/brand/imagotype-${tone}.svg`} alt="unosquare" width={284} height={80} className={className} />;
}
