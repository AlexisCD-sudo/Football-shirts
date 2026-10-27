import type { Shirt, ShirtInput, Team } from '../types/shirt';

/**
 * Contracte d'accés a les dades. A la fase 3 s'afegirà una implementació amb
 * Supabase sense canviar res de la interfície d'usuari.
 */
export interface ShirtRepository {
  /** `memory`: les dades només viuen a la sessió. `cloud`: persistides al servidor. */
  readonly persistence: 'memory' | 'cloud';
  listShirts(): Promise<Shirt[]>;
  listTeams(): Promise<Team[]>;
  createShirt(input: ShirtInput): Promise<Shirt>;
  updateShirt(id: string, input: ShirtInput): Promise<Shirt>;
  deleteShirt(id: string): Promise<void>;
}
