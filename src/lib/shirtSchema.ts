import { z } from 'zod';
import {
  AUTHENTICITIES,
  CONDITIONS,
  KIT_TYPES,
  VERSIONS,
  type Shirt,
  type ShirtInput,
  type TeamKind,
} from '../types/shirt';

/** Valors del formulari: tot són textos, tal com els escriu la persona. */
export interface ShirtFormValues {
  teamName: string;
  teamKind: TeamKind;
  country: string;
  season: string;
  competition: string;
  brand: string;
  model: string;
  kitType: string;
  version: string;
  playerName: string;
  squadNumber: string;
  size: string;
  manufactureYear: string;
  condition: string;
  authenticity: string;
  provenance: string;
  purchaseDate: string;
  price: string;
  shippingCost: string;
  seller: string;
  estimatedValue: string;
  location: string;
  notes: string;
  curiosities: string;
}

export const emptyFormValues: ShirtFormValues = {
  teamName: '',
  teamKind: 'club',
  country: '',
  season: '',
  competition: '',
  brand: '',
  model: '',
  kitType: '',
  version: 'unknown',
  playerName: '',
  squadNumber: '',
  size: '',
  manufactureYear: '',
  condition: '',
  authenticity: 'unverified',
  provenance: '',
  purchaseDate: '',
  price: '',
  shippingCost: '',
  seller: '',
  estimatedValue: '',
  location: '',
  notes: '',
  curiosities: '',
};

const optText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Màxim ${max} caràcters`)
    .transform((v) => (v === '' ? null : v));

function optNumber(opts: { min: number; max?: number; int?: boolean; message: string }) {
  return z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : Number(v.replace(',', '.'))))
    .pipe(
      z
        .number({ invalid_type_error: opts.message })
        .min(opts.min, opts.message)
        .max(opts.max ?? Number.MAX_SAFE_INTEGER, opts.message)
        .refine((n) => !opts.int || Number.isInteger(n), opts.message)
        .nullable(),
    );
}

function optEnum<T extends string>(values: readonly T[], message: string) {
  return z
    .string()
    .refine((v) => v === '' || (values as readonly string[]).includes(v), message)
    .transform((v) => (v === '' ? null : (v as T)));
}

const money = (label: string) =>
  optNumber({ min: 0, max: 1_000_000, message: `${label}: indica un import vàlid (0 o més)` });

export const shirtFormSchema = z.object({
  teamName: z.string().trim().min(1, "Cal indicar l'equip o la selecció").max(120),
  teamKind: z.enum(['club', 'national']),
  country: optText(80),
  season: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{4}-\d{2}$/.test(v), 'Format AAAA-AA (p. ex. 2010-11)')
    .transform((v) => (v === '' ? null : v)),
  competition: optText(120),
  brand: optText(80),
  model: optText(120),
  kitType: optEnum(KIT_TYPES, 'Tipus no vàlid'),
  version: z.enum(VERSIONS as [ShirtInput['version'], ...ShirtInput['version'][]]),
  playerName: optText(120),
  squadNumber: optNumber({ min: 0, max: 99, int: true, message: 'El dorsal ha de ser un enter entre 0 i 99' }),
  size: optText(20),
  manufactureYear: optNumber({ min: 1880, max: 2100, int: true, message: "Any de fabricació no vàlid" }),
  condition: optEnum(CONDITIONS, 'Estat no vàlid'),
  authenticity: z.enum(AUTHENTICITIES as [ShirtInput['authenticity'], ...ShirtInput['authenticity'][]]),
  provenance: optText(),
  purchaseDate: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Data no vàlida')
    .transform((v) => (v === '' ? null : v)),
  price: money('Preu'),
  shippingCost: money('Enviament'),
  seller: optText(120),
  estimatedValue: money('Valor estimat'),
  location: optText(120),
  notes: optText(2000),
  curiosities: optText(2000),
});

export type ParseResult =
  | { ok: true; data: ShirtInput }
  | { ok: false; errors: Partial<Record<keyof ShirtFormValues, string>> };

export function parseShirtForm(values: ShirtFormValues): ParseResult {
  const result = shirtFormSchema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };
  const errors: Partial<Record<keyof ShirtFormValues, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof ShirtFormValues | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

const str = (v: string | number | null): string => (v === null ? '' : String(v));

export function shirtToFormValues(s: Shirt): ShirtFormValues {
  return {
    teamName: s.team.name,
    teamKind: s.team.kind,
    country: str(s.team.country),
    season: str(s.season),
    competition: str(s.competition),
    brand: str(s.brand),
    model: str(s.model),
    kitType: str(s.kitType),
    version: s.version,
    playerName: str(s.playerName),
    squadNumber: str(s.squadNumber),
    size: str(s.size),
    manufactureYear: str(s.manufactureYear),
    condition: str(s.condition),
    authenticity: s.authenticity,
    provenance: str(s.provenance),
    purchaseDate: str(s.purchaseDate),
    price: str(s.price),
    shippingCost: str(s.shippingCost),
    seller: str(s.seller),
    estimatedValue: str(s.estimatedValue),
    location: str(s.location),
    notes: str(s.notes),
    curiosities: str(s.curiosities),
  };
}
