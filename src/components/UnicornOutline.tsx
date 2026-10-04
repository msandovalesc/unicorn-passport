import { OUTLINE_PATH, OUTLINE_VIEWBOX } from "@/lib/unicornOutline";

/**
 * Line-art unicorn (the outlined artwork, ® removed). Used as a light illustration on secondary
 * screens: check-in messages, the code entry page, empty states and 404. Takes the text color
 * by default, so it adapts to light and dark screens.
 */
export function UnicornOutline({
  size = 96,
  color = "currentColor",
  weight = 3,
  className,
  title,
}: {
  size?: number;
  color?: string;
  /** Extra line weight in artwork units (the source lines are 4 units in a 449-unit box). */
  weight?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox={OUTLINE_VIEWBOX}
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <path d={OUTLINE_PATH} fill={color} stroke={weight ? color : undefined} strokeWidth={weight || undefined} strokeLinejoin="miter" />
    </svg>
  );
}
