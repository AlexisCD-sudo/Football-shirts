const money = new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' });
const date = new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });

export function formatMoney(value: number | null): string | null {
  return value === null ? null : money.format(value);
}

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : date.format(d);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts
    .slice(0, 3)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

/** Tonalitat estable (0-359) derivada del text, per al marcador de «sense foto». */
export function hueFrom(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
