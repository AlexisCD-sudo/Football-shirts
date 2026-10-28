import type { ShirtInput } from '../types/shirt';
import { normalize } from './catalog';

export type ColumnKey = keyof ShirtInput;

export interface ColumnDef {
  key: ColumnKey;
  /** Capçalera canònica (la que fa servir l'exportació). */
  header: string;
  /** Altres capçaleres reconegudes en importar (sense accents ni majúscules). */
  aliases: string[];
}

export const COLUMNS: ColumnDef[] = [
  { key: 'teamName', header: 'Equip', aliases: ['equip', 'equipo', 'team', 'club', 'equip o seleccio', 'club o seleccio'] },
  { key: 'teamKind', header: "Tipus d'equip", aliases: ['tipus equip', 'tipus d equip', 'tipus', 'team type', 'kind'] },
  { key: 'country', header: 'País', aliases: ['pais', 'country'] },
  { key: 'season', header: 'Temporada', aliases: ['any', 'temporada', 'season', 'year'] },
  { key: 'competition', header: 'Competició', aliases: ['competicio', 'competition'] },
  { key: 'kitType', header: 'Equipació', aliases: ['home away', 'equipacio', 'kit', 'tipus d equipacio'] },
  { key: 'brand', header: 'Marca', aliases: ['marca', 'brand'] },
  { key: 'model', header: 'Model', aliases: ['model'] },
  { key: 'version', header: 'Versió', aliases: ['versio', 'version', 'repliques', 'replica'] },
  { key: 'playerName', header: 'Jugador', aliases: ['nom', 'jugador', 'player'] },
  { key: 'squadNumber', header: 'Dorsal', aliases: ['dorsal', 'numero', 'number'] },
  { key: 'size', header: 'Talla', aliases: ['talla', 'size'] },
  { key: 'manufactureYear', header: 'Any de fabricació', aliases: ['any de fabricacio', 'any fabricacio', 'manufacture year'] },
  { key: 'condition', header: 'Estat de conservació', aliases: ['estat de conservacio', 'estat', 'condicio', 'condition'] },
  { key: 'authenticity', header: 'Autenticitat', aliases: ['autenticitat', 'authenticity'] },
  { key: 'provenance', header: 'Procedència', aliases: ['procedencia', 'provenance'] },
  { key: 'purchaseDate', header: 'Data de compra', aliases: ['data de compra', 'data compra', 'purchase date'] },
  { key: 'price', header: 'Preu', aliases: ['preu', 'price'] },
  { key: 'shippingCost', header: 'Enviament', aliases: ['enviament', 'despeses d enviament', 'shipping'] },
  { key: 'seller', header: 'Venedor o botiga', aliases: ['venedor', 'botiga', 'venedor o botiga', 'seller'] },
  { key: 'estimatedValue', header: 'Valor estimat', aliases: ['valor estimat', 'valor', 'estimated value'] },
  { key: 'location', header: 'Ubicació', aliases: ['ubicacio', 'ubicacio fisica', 'location'] },
  { key: 'notes', header: 'Observacions', aliases: ['observacions', 'notes', 'notes'] },
  { key: 'curiosities', header: 'Curiositats', aliases: ['curiositats', 'curiosities'] },
];

export const columnByKey = (key: ColumnKey): ColumnDef => COLUMNS.find((c) => c.key === key)!;

export function normalizeHeader(text: string): string {
  return normalize(text).replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Troba la columna que correspon a una capçalera, o `null` si no es reconeix. */
export function matchHeader(header: string): ColumnKey | null {
  const h = normalizeHeader(header);
  if (!h) return null;
  const exact = COLUMNS.find((c) => normalizeHeader(c.header) === h);
  if (exact) return exact.key;
  const alias = COLUMNS.find((c) => c.aliases.includes(h));
  return alias ? alias.key : null;
}
