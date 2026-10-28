import { hueFrom, initials } from '../lib/format';
import type { Shirt } from '../types/shirt';

/** Marcador neutre mentre no hi ha una fotografia confirmada. No és una imatge real. */
export function ShirtPlaceholder({ shirt }: { shirt: Shirt }) {
  const hue = hueFrom(shirt.team.name);
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center"
      style={{ background: `linear-gradient(160deg, hsl(${hue} 22% 86%), hsl(${hue} 26% 74%))` }}
      aria-label="Sense fotografia"
      role="img"
    >
      <svg viewBox="0 0 64 64" className="w-1/2" aria-hidden>
        <path
          d="M22 10l-15 8 5 11 7-3v28h26V26l7 3 5-11-15-8c-2 5-6 7-10 7s-8-2-10-7z"
          fill={`hsl(${hue} 30% 38%)`}
          opacity="0.9"
        />
        <text x="32" y="42" textAnchor="middle" fontSize="11" fontWeight="700" fill="white" fontFamily="Fraunces, serif">
          {initials(shirt.team.name)}
        </text>
      </svg>
      <span className="mt-1 text-[11px] uppercase tracking-widest text-black/50">Sense foto</span>
    </div>
  );
}
