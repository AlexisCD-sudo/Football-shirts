import { useMemo, useState, type ChangeEvent } from 'react';
import { COLUMNS, type ColumnKey } from '../lib/columns';
import {
  SAMPLE_SIZE,
  buildPreview,
  isTeamMapped,
  selectForImport,
  suggestMapping,
  summarize,
  toImportItems,
  type MappingTarget,
  type PreviewRow,
} from '../lib/importer';
import { readTableFromFile, type Table } from '../lib/spreadsheet';
import type { ImportReport, ShirtRepository } from '../services/shirtRepository';
import type { Shirt, Team } from '../types/shirt';
import { Modal, buttonCls, inputCls, primaryCls } from './ui';

interface Props {
  repository: ShirtRepository;
  shirts: Shirt[];
  teams: Team[];
  onImported: () => Promise<void> | void;
  onClose: () => void;
}

type Step =
  | { name: 'file' }
  | { name: 'review' }
  | { name: 'importing'; done: number; total: number }
  | { name: 'done'; report: ImportReport; attempted: number; skipped: number };

export function ImportDialog({ repository, shirts, teams, onImported, onClose }: Props) {
  const [step, setStep] = useState<Step>({ name: 'file' });
  const [filename, setFilename] = useState('');
  const [table, setTable] = useState<Table | null>(null);
  const [mapping, setMapping] = useState<MappingTarget[]>([]);
  const [scope, setScope] = useState<'sample' | 'all'>('sample');
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const rows = useMemo(
    () => (table && isTeamMapped(mapping) ? buildPreview(table, mapping, shirts) : []),
    [table, mapping, shirts],
  );
  const summary = useMemo(() => summarize(rows, teams.map((t) => t.name)), [rows, teams]);
  const isIncluded = (r: PreviewRow) => overrides[r.sourceRow] ?? (r.input !== null && r.duplicate === null);
  const selected = selectForImport(rows, isIncluded, scope);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const t = await readTableFromFile(file);
      if (t.rows.length === 0) throw new Error('El fitxer no té cap fila de dades.');
      setTable(t);
      setMapping(suggestMapping(t.headers));
      setFilename(file.name);
      setOverrides({});
      setStep({ name: 'review' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No s’ha pogut llegir el fitxer.');
    } finally {
      setLoading(false);
    }
  }

  function setTarget(idx: number, target: MappingTarget) {
    setMapping((m) => m.map((t, i) => (i === idx ? target : target !== 'ignore' && t === target ? 'ignore' : t)));
    setOverrides({});
  }

  async function runImport() {
    const items = toImportItems(selected);
    setStep({ name: 'importing', done: 0, total: items.length });
    setError(null);
    try {
      const report = await repository.importShirts(
        items,
        {
          filename,
          columnMapping: Object.fromEntries((table?.headers ?? []).map((h, i) => [h, mapping[i] ?? 'ignore'])),
          summary: { ...summary, scope },
        },
        (done, total) => setStep({ name: 'importing', done, total }),
      );
      await onImported();
      setStep({ name: 'done', report, attempted: items.length, skipped: summary.total - items.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La importació ha fallat.');
      setStep({ name: 'review' });
    }
  }

  function downloadReport(report: ImportReport, attempted: number) {
    const blob = new Blob([JSON.stringify({ filename, attempted, ...report }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'informe-importacio.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const used = new Set(mapping.filter((m): m is ColumnKey => m !== 'ignore'));
  const canImport = isTeamMapped(mapping) && selected.length > 0;

  return (
    <Modal title="Importa samarretes" onClose={onClose} wide>
      {step.name === 'file' && (
        <div>
          <p className="text-sm text-muted">
            Carrega un fitxer <strong>CSV</strong> o <strong>Excel (.xlsx)</strong>. Si tens un fitxer de Numbers, exporta&rsquo;l abans:
            Arxiu → Exporta a → CSV. No es modificarà ni s&rsquo;esborrarà res; primer veuràs una vista prèvia.
          </p>
          <label htmlFor="import-file" className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted">
            Fitxer
          </label>
          <input
            id="import-file"
            type="file"
            accept=".csv,.txt,.xlsx"
            className={inputCls}
            onChange={(e) => void onFile(e)}
            disabled={loading}
          />
          {loading && <p className="mt-3 text-sm text-muted">Llegint el fitxer…</p>}
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}

      {step.name === 'review' && table && (
        <div className="space-y-5">
          <p className="text-sm text-muted">
            <strong>{filename}</strong> · {table.rows.length} files
          </p>

          <section aria-label="Mapeig de columnes">
            <h3 className="mb-2 font-display text-base font-bold">1. Columnes</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {table.headers.map((h, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-md border border-line bg-card p-2">
                  <span className="min-w-0 flex-1 truncate text-sm" title={h}>
                    {h}
                    <span className="block truncate text-xs text-muted">{table.rows[0]?.[idx] || '—'}</span>
                  </span>
                  <select
                    aria-label={`Camp per a la columna ${h}`}
                    className={`${inputCls} max-w-[11rem]`}
                    value={mapping[idx] ?? 'ignore'}
                    onChange={(e) => setTarget(idx, e.target.value as MappingTarget)}
                  >
                    <option value="ignore">Ignora (es conserva)</option>
                    {COLUMNS.map((c) => (
                      <option key={c.key} value={c.key} disabled={used.has(c.key) && mapping[idx] !== c.key}>
                        {c.header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {!isTeamMapped(mapping) && (
              <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
                Cal assignar una columna al camp «Equip».
              </p>
            )}
            <p className="mt-2 text-xs text-muted">
              Les columnes ignorades no es perden: la fila original sencera es desa amb cada samarreta.
            </p>
          </section>

          {isTeamMapped(mapping) && (
            <>
              <section aria-label="Resum">
                <h3 className="mb-2 font-display text-base font-bold">2. Resum</h3>
                <ul className="flex flex-wrap gap-2 text-sm">
                  <li className="rounded-full border border-line bg-card px-3 py-1">{summary.total} files</li>
                  <li className="rounded-full border border-line bg-card px-3 py-1">{summary.valid} vàlides</li>
                  <li className="rounded-full border border-line bg-card px-3 py-1">{summary.withWarnings} amb avisos</li>
                  <li className="rounded-full border border-line bg-card px-3 py-1">{summary.duplicates} possibles duplicats</li>
                  <li className="rounded-full border border-line bg-card px-3 py-1">{summary.errors} amb errors</li>
                </ul>
                {summary.newTeams.length > 0 && (
                  <p className="mt-2 text-xs text-muted">
                    Equips nous que es crearan ({summary.newTeams.length}): {summary.newTeams.join(', ')}.
                    {!used.has('teamKind') && " Com que no hi ha cap columna de tipus d'equip, es crearan com a «Club»; podràs corregir-ho després."}
                  </p>
                )}
              </section>

              <section aria-label="Vista prèvia">
                <h3 className="mb-2 font-display text-base font-bold">3. Vista prèvia</h3>
                <div className="max-h-72 overflow-auto rounded-md border border-line">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-paper">
                      <tr>
                        <th className="p-2">Importa</th>
                        <th className="p-2">Fila</th>
                        <th className="p-2">Equip</th>
                        <th className="p-2">Temporada</th>
                        <th className="p-2">Estat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.sourceRow} className="border-t border-line align-top">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              aria-label={`Importa la fila ${r.sourceRow}`}
                              checked={isIncluded(r)}
                              disabled={r.input === null}
                              onChange={(e) => setOverrides((o) => ({ ...o, [r.sourceRow]: e.target.checked }))}
                            />
                          </td>
                          <td className="p-2">{r.sourceRow}</td>
                          <td className="p-2">{r.input?.teamName ?? r.original[table.headers[mapping.indexOf('teamName')]] ?? ''}</td>
                          <td className="p-2">{r.input?.season ?? '—'}</td>
                          <td className="p-2">
                            {r.errors.map((m) => (
                              <p key={m} className="text-red-700 dark:text-red-400">
                                {m}
                              </p>
                            ))}
                            {r.duplicate && (
                              <p className="text-amber-700 dark:text-amber-400">
                                {r.duplicate === 'collection'
                                  ? 'Ja existeix a la col·lecció (mateix equip, temporada i equipació)'
                                  : 'Repetida dins del fitxer (mateix equip, temporada i equipació)'}
                              </p>
                            )}
                            {r.warnings.map((m) => (
                              <p key={m} className="text-muted">
                                {m}
                              </p>
                            ))}
                            {r.errors.length === 0 && !r.duplicate && r.warnings.length === 0 && <span className="text-muted">OK</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Els possibles duplicats no es fusionen ni s&rsquo;esborren: estan desmarcats per defecte i tu decideixes.
                </p>
              </section>

              <section aria-label="Abast">
                <h3 className="mb-2 font-display text-base font-bold">4. Què s&rsquo;importa</h3>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="scope" checked={scope === 'sample'} onChange={() => setScope('sample')} />
                  Només una mostra de prova ({SAMPLE_SIZE} primeres files marcades)
                </label>
                <label className="mt-1 flex items-center gap-2 text-sm">
                  <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />
                  Totes les files marcades
                </label>
              </section>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
            <button type="button" className={buttonCls} onClick={() => setStep({ name: 'file' })}>
              Canvia de fitxer
            </button>
            <button type="button" className={primaryCls} disabled={!canImport} onClick={() => void runImport()}>
              {`Importa ${selected.length} ${selected.length === 1 ? 'samarreta' : 'samarretes'}`}
            </button>
          </div>
        </div>
      )}

      {step.name === 'importing' && (
        <div role="status">
          <p className="text-sm">
            Important… {step.done} de {step.total}
          </p>
          <progress className="mt-2 w-full" value={step.done} max={Math.max(step.total, 1)} />
        </div>
      )}

      {step.name === 'done' && (
        <div>
          <h3 className="font-display text-xl font-bold">Importació acabada</h3>
          <ul className="mt-3 space-y-1 text-sm">
            <li>Importades: <strong>{step.report.imported}</strong></li>
            <li>Fallades: <strong>{step.report.failed.length}</strong></li>
            <li>No importades (desmarcades, duplicats, errors o fora de la mostra): <strong>{step.skipped}</strong></li>
          </ul>
          {step.report.failed.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-sm text-red-700 dark:text-red-400">
              {step.report.failed.map((f) => (
                <li key={f.sourceRow}>
                  Fila {f.sourceRow}: {f.message}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            Si has fet una prova amb mostra, torna a obrir la importació amb el mateix fitxer: les peces ja importades
            sortiran com a possibles duplicats i quedaran desmarcades.
          </p>
          <div className="mt-5 flex justify-between gap-2">
            <button type="button" className={buttonCls} onClick={() => downloadReport(step.report, step.attempted)}>
              Descarrega l&rsquo;informe
            </button>
            <button type="button" className={primaryCls} onClick={onClose}>
              Tanca
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
