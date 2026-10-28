import type { ImportItem } from '../lib/importer';
import type { Shirt, ShirtInput, Team } from '../types/shirt';

/**
 * Contracte d'accés a les dades. A la fase 3 s'afegirà una implementació amb
 * Supabase sense canviar res de la interfície d'usuari.
 */
export interface ImportMeta {
  filename: string;
  columnMapping: Record<string, string>;
  summary: Record<string, unknown>;
}

export interface ImportReport {
  batchId: string;
  imported: number;
  failed: { sourceRow: number; message: string }[];
}

export interface ShirtRepository {
  /** `memory`: les dades només viuen a la sessió. `cloud`: persistides al servidor. */
  readonly persistence: 'memory' | 'cloud';
  listShirts(): Promise<Shirt[]>;
  listTeams(): Promise<Team[]>;
  createShirt(input: ShirtInput): Promise<Shirt>;
  updateShirt(id: string, input: ShirtInput): Promise<Shirt>;
  deleteShirt(id: string): Promise<void>;
  /**
   * Importa per lots. Mai elimina ni fusiona res i NO modifica els equips existents
   * (només en crea els que falten). Cada fila conserva la seva dada original.
   */
  importShirts(
    items: ImportItem[],
    meta: ImportMeta,
    onProgress?: (done: number, total: number) => void,
  ): Promise<ImportReport>;
}
