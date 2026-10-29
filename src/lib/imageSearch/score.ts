import { normalize } from '../catalog';
import type { Shirt } from '../../types/shirt';
import type { ImageCandidate } from './types';

export const PROBABLE = 0.6;
export const POSSIBLE = 0.35;

const SHIRT_WORDS = ['shirt', 'jersey', 'camiseta', 'camisa', 'maillot', 'trikot', 'samarreta', 'kit', 'maglia'];
const BAD_WORDS = ['logo', 'badge', 'crest', 'escudo', 'stadium', 'estadio', 'estadi', 'supporters', 'fans', 'flag', 'bandera', 'crowd', 'match report'];
const KIT_WORDS: Record<string, string[]> = {
  home: ['home', 'local', 'casa'],
  away: ['away', 'visitant', 'fora', 'visitante'],
  third: ['third', 'tercera'],
  goalkeeper: ['goalkeeper', 'porter', 'portero', 'gk'],
  special: ['special', 'especial', 'anniversary'],
  training: ['training', 'entrenament'],
};

const STOP = new Set(['de', 'del', 'la', 'el', 'fc', 'cf', 'cd', 'sc', 'ac', 'as', 'the', 'club']);

function words(text: string): string[] {
  return normalize(text).split(/[^a-z0-9]+/).filter(Boolean);
}

function seasonForms(season: string): { full: string[]; startYear: string } {
  const [start, endShort] = season.split('-');
  const endFull = String(Number(start) + 1);
  return {
    full: [`${start}-${endShort}`, `${start}/${endShort}`, `${start}-${endFull}`, `${start}/${endFull}`, `${start} ${endShort}`],
    startYear: start,
  };
}

/**
 * Puntuació 0–1 de com bé una candidata encaixa amb la samarreta. És una heurística sobre el text
 * (títol, descripció): NO verifica la imatge. Serveix per ordenar, mai per assignar sola.
 */
export function scoreCandidate(shirt: Shirt, c: ImageCandidate): number {
  const raw = `${c.title} ${c.extraText ?? ''} ${c.sourcePageUrl}`;
  const text = normalize(raw.replace(/[_]+/g, ' '));
  const tokens = new Set(words(raw));

  const teamTokens = words(shirt.team.name).filter((w) => !STOP.has(w) && w.length > 1);
  const teamHits = teamTokens.filter((t) => tokens.has(t) || text.includes(t)).length;
  const team = teamTokens.length ? teamHits / teamTokens.length : 0;

  let seasonScore = 0;
  const hasSeason = !!shirt.season && /^\d{4}-\d{2}$/.test(shirt.season);
  if (hasSeason) {
    const f = seasonForms(shirt.season as string);
    const compact = text.replace(/[–—]/g, '-');
    if (f.full.some((s) => compact.includes(s))) seasonScore = 1;
    else if (new RegExp(`\\b${f.startYear}\\b`).test(compact)) seasonScore = 0.5;
  }

  const kitWords = shirt.kitType ? KIT_WORDS[shirt.kitType] ?? [] : [];
  const kit = kitWords.length && kitWords.some((w) => tokens.has(w)) ? 1 : 0;
  const shirtWord = SHIRT_WORDS.some((w) => tokens.has(w)) ? 1 : 0;

  const playerTokens = shirt.playerName ? words(shirt.playerName) : [];
  const player = playerTokens.length ? (playerTokens.some((t) => tokens.has(t)) ? 1 : 0) : 0;

  // Els pesos es reparteixen entre els criteris que la samarreta realment té.
  const parts: [number, number][] = [
    [0.4, team],
    [0.12, shirtWord],
  ];
  if (hasSeason) parts.push([0.3, seasonScore]);
  if (kitWords.length) parts.push([0.08, kit]);
  if (playerTokens.length) parts.push([0.1, player]);
  const totalWeight = parts.reduce((a, [w]) => a + w, 0);
  let score = parts.reduce((a, [w, v]) => a + w * v, 0) / totalWeight;

  if (BAD_WORDS.some((w) => tokens.has(w) || text.includes(`${w} `))) score -= 0.2;
  // Sense res de l'equip, mai pot ser prou fiable.
  if (team === 0) score = Math.min(score, 0.2);
  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

export type Confidence = 'probable' | 'possible' | 'low';

export function confidence(score: number | null): Confidence {
  if (score === null) return 'low';
  if (score >= PROBABLE) return 'probable';
  if (score >= POSSIBLE) return 'possible';
  return 'low';
}

export const confidenceLabels: Record<Confidence, string> = {
  probable: 'Coincidència probable',
  possible: 'Coincidència possible',
  low: 'Coincidència baixa',
};
