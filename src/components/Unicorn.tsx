import { ART_VIEWBOX, BODY_PATHS, MANE_PATHS, type UnicornColors } from "@/lib/unicorn";

export function Unicorn({ colors, title, className }: { colors: UnicornColors; title?: string; className?: string }) {
  return (
    <svg viewBox={ART_VIEWBOX} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {MANE_PATHS.map((d) => (
        <path key={d} d={d} fill={colors.mane} />
      ))}
      {BODY_PATHS.map((d) => (
        <path key={d} d={d} fill={colors.body} />
      ))}
    </svg>
  );
}
