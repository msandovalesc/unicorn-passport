/**
 * Background texture: scattered pixel unicorns in random sizes and angles at low opacity.
 * Use only on dark/blue screens (sign-up, check-in success, web card), never behind dense
 * text, tables or forms. Deterministic per `seed` so server and client render the same layout.
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function UnicornPattern({ seed = 7, count = 14, opacity = [0.05, 0.12] }: { seed?: number; count?: number; opacity?: [number, number] }) {
  const rand = mulberry32(seed);
  const items = Array.from({ length: count }, () => ({
    left: rand() * 100,
    top: rand() * 100,
    size: 28 + rand() * 120,
    rotate: -35 + rand() * 70,
    flip: rand() > 0.6,
    opacity: opacity[0] + rand() * (opacity[1] - opacity[0]),
  }));

  return (
    <div className="unicorn-pattern" aria-hidden>
      {items.map((u, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src="/brand/unicorn-light.svg"
          alt=""
          width={u.size}
          height={u.size}
          style={{
            left: `${u.left}%`,
            top: `${u.top}%`,
            opacity: u.opacity,
            transform: `translate(-50%, -50%) rotate(${u.rotate}deg) scaleX(${u.flip ? -1 : 1})`,
          }}
        />
      ))}
    </div>
  );
}
