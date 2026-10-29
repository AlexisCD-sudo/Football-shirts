import { normalize } from '../lib/catalog';
import type { ImportItem } from '../lib/importer';
import type {
  Budget,
  ImageJob,
  ImageJobItem,
  Shirt,
  ShirtImage,
  ShirtInput,
  Team,
  WishlistInput,
  WishlistItem,
} from '../types/shirt';
import type {
  ImageJobItemPatch,
  ImageJobPatch,
  ImportMeta,
  ImportReport,
  NewCandidate,
  ShirtRepository,
} from './shirtRepository';

type StoredShirt = Omit<Shirt, 'team'> & { teamId: string };

/**
 * Implementació provisional en memòria (fase 2). Comença BUIDA: no hi ha dades
 * de demostració a la col·lecció real. Es perd en recarregar la pàgina.
 */
type WishlistRecord = Omit<WishlistItem, 'team'> & { teamId: string };

const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export class MemoryShirtRepository implements ShirtRepository {
  readonly persistence = 'memory' as const;
  private teams = new Map<string, Team>();
  private shirts = new Map<string, StoredShirt>();
  private images = new Map<string, ShirtImage>();
  private jobs: ImageJob[] = [];
  private jobItems = new Map<string, ImageJobItem>();
  private wishlist = new Map<string, WishlistRecord>();
  private budgets = new Map<number, number>();

  private resolveTeam(input: Pick<ShirtInput, 'teamName' | 'teamKind' | 'country'>): Team {
    const key = normalize(input.teamName);
    const existing = [...this.teams.values()].find((t) => normalize(t.name) === key);
    if (existing) {
      const updated: Team = {
        ...existing,
        kind: input.teamKind,
        country: input.country ?? existing.country,
      };
      this.teams.set(existing.id, updated);
      return updated;
    }
    const team: Team = {
      id: crypto.randomUUID(),
      name: input.teamName.trim(),
      kind: input.teamKind,
      country: input.country,
    };
    this.teams.set(team.id, team);
    return team;
  }

  private compose(s: StoredShirt): Shirt {
    const { teamId, ...rest } = s;
    const team = this.teams.get(teamId);
    if (!team) throw new Error('Equip inexistent');
    const primary = [...this.images.values()].find((i) => i.shirtId === s.id && i.isPrimary && i.status === 'confirmed');
    return { ...rest, photoUrl: primary?.imageUrl ?? null, team: { ...team } };
  }

  private fields(input: ShirtInput) {
    const { teamName, teamKind, country, ...rest } = input;
    void teamName;
    void teamKind;
    void country;
    return rest;
  }

  async listShirts(): Promise<Shirt[]> {
    return [...this.shirts.values()].map((s) => this.compose(s));
  }

  async listTeams(): Promise<Team[]> {
    return [...this.teams.values()].map((t) => ({ ...t }));
  }

  async createShirt(input: ShirtInput): Promise<Shirt> {
    const team = this.resolveTeam(input);
    const now = new Date().toISOString();
    const stored: StoredShirt = {
      ...this.fields(input),
      id: crypto.randomUUID(),
      teamId: team.id,
      photoUrl: null,
      importBatchId: null,
      sourceRow: null,
      originalData: null,
      createdAt: now,
      updatedAt: now,
    };
    this.shirts.set(stored.id, stored);
    return this.compose(stored);
  }

  async updateShirt(id: string, input: ShirtInput): Promise<Shirt> {
    const current = this.shirts.get(id);
    if (!current) throw new Error('La samarreta ja no existeix');
    const team = this.resolveTeam(input);
    const stored: StoredShirt = {
      ...current,
      ...this.fields(input),
      teamId: team.id,
      updatedAt: new Date().toISOString(),
    };
    this.shirts.set(id, stored);
    return this.compose(stored);
  }

  /** Troba o crea l'equip SENSE modificar-ne el tipus ni el país si ja existeix. */
  private teamForImport(input: ShirtInput): Team {
    const key = normalize(input.teamName);
    const existing = [...this.teams.values()].find((t) => normalize(t.name) === key);
    if (existing) return existing;
    return this.resolveTeam(input);
  }

  async importShirts(
    items: ImportItem[],
    _meta: ImportMeta,
    onProgress?: (done: number, total: number) => void,
  ): Promise<ImportReport> {
    const batchId = crypto.randomUUID();
    const failed: ImportReport['failed'] = [];
    let imported = 0;
    for (const [i, item] of items.entries()) {
      try {
        const team = this.teamForImport(item.input);
        const now = new Date().toISOString();
        const stored: StoredShirt = {
          ...this.fields(item.input),
          id: crypto.randomUUID(),
          teamId: team.id,
          photoUrl: null,
          importBatchId: batchId,
          sourceRow: item.sourceRow,
          originalData: { ...item.original },
          createdAt: now,
          updatedAt: now,
        };
        this.shirts.set(stored.id, stored);
        imported += 1;
      } catch (e) {
        failed.push({ sourceRow: item.sourceRow, message: e instanceof Error ? e.message : 'Error desconegut' });
      }
      onProgress?.(i + 1, items.length);
    }
    return { batchId, imported, failed };
  }

  async deleteShirt(id: string): Promise<void> {
    if (!this.shirts.delete(id)) throw new Error('La samarreta ja no existeix');
    for (const [imageId, img] of this.images) if (img.shirtId === id) this.images.delete(imageId);
    for (const w of this.wishlist.values()) if (w.acquiredShirtId === id) w.acquiredShirtId = null;
  }

  // ───────── Fotografies ─────────
  async listImages(): Promise<ShirtImage[]> {
    return [...this.images.values()].map((i) => ({ ...i }));
  }

  private requireShirt(id: string): void {
    if (!this.shirts.has(id)) throw new Error('La samarreta ja no existeix');
  }

  private requireImage(id: string): ShirtImage {
    const img = this.images.get(id);
    if (!img) throw new Error('La imatge ja no existeix');
    return img;
  }

  async addCandidates(shirtId: string, candidates: NewCandidate[]): Promise<number> {
    this.requireShirt(shirtId);
    const known = new Set([...this.images.values()].filter((i) => i.shirtId === shirtId).map((i) => i.imageUrl));
    let added = 0;
    for (const c of candidates) {
      if (known.has(c.imageUrl)) continue;
      known.add(c.imageUrl);
      const img: ShirtImage = {
        id: crypto.randomUUID(),
        shirtId,
        origin: 'external',
        status: 'candidate',
        isPrimary: false,
        imageUrl: c.imageUrl,
        thumbnailUrl: c.thumbnailUrl,
        sourcePageUrl: c.sourcePageUrl,
        source: c.source,
        author: c.author,
        license: c.license,
        licenseUrl: c.licenseUrl,
        matchScore: c.matchScore,
        retrievedAt: new Date().toISOString(),
        selectedAt: null,
        storagePath: null,
      };
      this.images.set(img.id, img);
      added += 1;
    }
    return added;
  }

  private demotePrimary(shirtId: string): void {
    for (const img of this.images.values()) {
      if (img.shirtId === shirtId && img.isPrimary) {
        img.isPrimary = false;
        img.status = 'candidate';
      }
    }
  }

  async confirmImage(imageId: string): Promise<void> {
    const img = this.requireImage(imageId);
    this.demotePrimary(img.shirtId);
    img.status = 'confirmed';
    img.isPrimary = true;
    img.selectedAt = new Date().toISOString();
  }

  async unconfirmImage(imageId: string): Promise<void> {
    const img = this.requireImage(imageId);
    img.status = 'candidate';
    img.isPrimary = false;
    img.selectedAt = null;
  }

  async rejectImage(imageId: string): Promise<void> {
    const img = this.requireImage(imageId);
    img.status = 'rejected';
    img.isPrimary = false;
    img.selectedAt = null;
  }

  async addManualImage(shirtId: string, imageUrl: string, sourcePageUrl?: string): Promise<void> {
    this.requireShirt(shirtId);
    const url = imageUrl.trim();
    if (!/^https?:\/\//i.test(url)) throw new Error('L\u2019enllaç ha de començar per http:// o https://');
    this.demotePrimary(shirtId);
    const existing = [...this.images.values()].find((i) => i.shirtId === shirtId && i.imageUrl === url);
    const now = new Date().toISOString();
    if (existing) {
      existing.status = 'confirmed';
      existing.isPrimary = true;
      existing.selectedAt = now;
      return;
    }
    const img: ShirtImage = {
      id: crypto.randomUUID(),
      shirtId,
      origin: 'external',
      status: 'confirmed',
      isPrimary: true,
      imageUrl: url,
      thumbnailUrl: null,
      sourcePageUrl: sourcePageUrl?.trim() || url,
      source: 'manual',
      author: null,
      license: null,
      licenseUrl: null,
      matchScore: null,
      retrievedAt: now,
      selectedAt: now,
      storagePath: null,
    };
    this.images.set(img.id, img);
  }

  async uploadPhoto(shirtId: string, file: Blob, contentType: string): Promise<void> {
    this.requireShirt(shirtId);
    if (!ALLOWED_UPLOAD_TYPES.includes(contentType)) throw new Error('Format no admès: usa JPG, PNG o WebP.');
    this.demotePrimary(shirtId);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : `blob:memory/${id}`;
    this.images.set(id, {
      id,
      shirtId,
      origin: 'stored',
      status: 'confirmed',
      isPrimary: true,
      imageUrl: url,
      thumbnailUrl: url,
      sourcePageUrl: null,
      source: 'upload',
      author: null,
      license: 'Foto pròpia',
      licenseUrl: null,
      matchScore: null,
      retrievedAt: now,
      selectedAt: now,
      storagePath: `memory/${shirtId}/${id}`,
    });
  }

  async deleteImage(imageId: string): Promise<void> {
    this.requireImage(imageId);
    this.images.delete(imageId);
  }

  // ───────── Cerca per lots ─────────
  async createImageJob(shirtIds: string[]): Promise<ImageJob> {
    const job: ImageJob = {
      id: crypto.randomUUID(),
      status: 'pending',
      total: shirtIds.length,
      done: 0,
      failed: 0,
      createdAt: new Date().toISOString(),
    };
    this.jobs.push(job);
    for (const shirtId of shirtIds) {
      const item: ImageJobItem = {
        id: crypto.randomUUID(),
        jobId: job.id,
        shirtId,
        status: 'pending',
        attempts: 0,
        lastError: null,
        candidatesFound: 0,
      };
      this.jobItems.set(item.id, item);
    }
    return { ...job };
  }

  async getLatestImageJob() {
    const job = this.jobs[this.jobs.length - 1];
    if (!job) return null;
    return {
      job: { ...job },
      items: [...this.jobItems.values()].filter((i) => i.jobId === job.id).map((i) => ({ ...i })),
    };
  }

  async updateImageJob(id: string, patch: ImageJobPatch): Promise<void> {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) throw new Error('La feina ja no existeix');
    Object.assign(job, patch);
  }

  async updateImageJobItem(id: string, patch: ImageJobItemPatch): Promise<void> {
    const item = this.jobItems.get(id);
    if (!item) throw new Error('L\u2019element de la feina ja no existeix');
    Object.assign(item, patch);
  }

  // ───────── Llista de desitjos i pressupost ─────────
  private composeWish(w: WishlistRecord): WishlistItem {
    const { teamId, ...rest } = w;
    const team = this.teams.get(teamId);
    if (!team) throw new Error('L’equip ja no existeix');
    return { ...rest, team: { ...team } };
  }

  private wishFields(input: WishlistInput) {
    const { teamName, teamKind, country, ...rest } = input;
    void teamName;
    void teamKind;
    void country;
    return rest;
  }

  async listWishlist(): Promise<WishlistItem[]> {
    return [...this.wishlist.values()].map((w) => this.composeWish(w));
  }

  async createWishlistItem(input: WishlistInput): Promise<WishlistItem> {
    const team = this.resolveTeam(input);
    const now = new Date().toISOString();
    const rec: WishlistRecord = {
      ...this.wishFields(input),
      id: crypto.randomUUID(),
      teamId: team.id,
      acquiredShirtId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.wishlist.set(rec.id, rec);
    return this.composeWish(rec);
  }

  async updateWishlistItem(id: string, input: WishlistInput): Promise<WishlistItem> {
    const current = this.wishlist.get(id);
    if (!current) throw new Error('El desig ja no existeix');
    const team = this.resolveTeam(input);
    const rec: WishlistRecord = {
      ...current,
      ...this.wishFields(input),
      teamId: team.id,
      updatedAt: new Date().toISOString(),
    };
    this.wishlist.set(id, rec);
    return this.composeWish(rec);
  }

  async deleteWishlistItem(id: string): Promise<void> {
    if (!this.wishlist.delete(id)) throw new Error('El desig ja no existeix');
  }

  async markWishlistAcquired(id: string, shirtId: string): Promise<WishlistItem> {
    const current = this.wishlist.get(id);
    if (!current) throw new Error('El desig ja no existeix');
    this.requireShirt(shirtId);
    const rec: WishlistRecord = { ...current, status: 'acquired', acquiredShirtId: shirtId, updatedAt: new Date().toISOString() };
    this.wishlist.set(id, rec);
    return this.composeWish(rec);
  }

  async listBudgets(): Promise<Budget[]> {
    return [...this.budgets.entries()].map(([year, amount]) => ({ year, amount })).sort((a, b) => b.year - a.year);
  }

  async setBudget(year: number, amount: number): Promise<void> {
    if (!Number.isInteger(year) || year < 1990 || year > 2100) throw new Error('Any no vàlid (1990–2100)');
    if (!Number.isFinite(amount) || amount < 0) throw new Error('L’import ha de ser 0 o més');
    this.budgets.set(year, Math.round(amount * 100) / 100);
  }

  async deleteBudget(year: number): Promise<void> {
    this.budgets.delete(year);
  }
}
