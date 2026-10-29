import { useState } from 'react';
import {
  CSV_MIME,
  downloadBlob,
  exportFilename,
  shirtsToCsv,
  shirtsToJson,
  shirtsToXlsx,
} from '../lib/export';
import { backupFilename, backupToJson, inspectBackup, type BackupCheck } from '../lib/backup';
import type { ShirtRepository } from '../services/shirtRepository';
import type { Shirt } from '../types/shirt';
import { Modal, buttonCls } from './ui';

export function ExportDialog({
  shirts,
  repository,
  onClose,
}: {
  shirts: Shirt[];
  repository?: ShirtRepository;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<BackupCheck | null>(null);

  async function backup() {
    if (!repository) return;
    setBusy('backup');
    setError(null);
    try {
      const [s, teams, images, wishlist, budgets] = await Promise.all([
        repository.listShirts(),
        repository.listTeams(),
        repository.listImages(),
        repository.listWishlist(),
        repository.listBudgets(),
      ]);
      const json = backupToJson({ shirts: s, teams, images, wishlist, budgets });
      downloadBlob(new Blob([json], { type: 'application/json' }), backupFilename());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No s’ha pogut generar la còpia.');
    } finally {
      setBusy(null);
    }
  }

  async function verify(file: File) {
    setCheck(null);
    try {
      setCheck(inspectBackup(await file.text()));
    } catch {
      setCheck({ ok: false, error: 'No s’ha pogut llegir el fitxer.' });
    }
  }

  async function run(kind: 'csv' | 'xlsx' | 'json') {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'csv') downloadBlob(new Blob([shirtsToCsv(shirts)], { type: CSV_MIME }), exportFilename('csv'));
      else if (kind === 'json')
        downloadBlob(new Blob([shirtsToJson(shirts)], { type: 'application/json' }), exportFilename('json'));
      else downloadBlob(await shirtsToXlsx(shirts), exportFilename('xlsx'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No s’ha pogut generar el fitxer.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal title="Exporta la col·lecció" onClose={onClose}>
      <p className="text-sm text-muted">
        {shirts.length === 0
          ? 'Encara no hi ha cap samarreta per exportar.'
          : `S'exportaran les ${shirts.length} samarretes, no només les que es veuen amb els filtres actuals.`}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <button type="button" className={buttonCls} disabled={shirts.length === 0 || busy !== null} onClick={() => void run('xlsx')}>
          {busy === 'xlsx' ? 'Generant…' : 'Excel (.xlsx)'}
        </button>
        <button type="button" className={buttonCls} disabled={shirts.length === 0 || busy !== null} onClick={() => void run('csv')}>
          CSV (.csv)
        </button>
        <button type="button" className={buttonCls} disabled={shirts.length === 0 || busy !== null} onClick={() => void run('json')}>
          JSON complet (.json)
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {repository && (
        <section aria-label="Còpia de seguretat" className="mt-5 border-t border-line pt-4">
          <h3 className="font-display text-base font-bold">Còpia de seguretat completa</h3>
          <p className="mt-1 text-xs text-muted">
            Samarretes, equips, fotos (metadades), desitjos i pressupostos en un sol fitxer. Les fotos pròpies no s&rsquo;hi
            inclouen.
          </p>
          <button type="button" className={`${buttonCls} mt-2`} disabled={busy !== null} onClick={() => void backup()}>
            {busy === 'backup' ? 'Generant…' : 'Descarrega la còpia (.json)'}
          </button>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted">
            Verifica una còpia
            <input
              type="file"
              accept="application/json,.json"
              aria-label="Verifica una còpia"
              className="mt-1 block w-full text-sm normal-case"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void verify(f);
              }}
            />
          </label>
          {check && (
            <p role={check.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${check.ok ? '' : 'text-red-700 dark:text-red-400'}`}>
              {check.ok
                ? `Còpia vàlida (${check.exportedAt.slice(0, 10)}): ${check.counts.shirts} samarretes, ${check.counts.teams} equips, ${check.counts.images} imatges, ${check.counts.wishlist} desitjos, ${check.counts.budgets} pressupostos.`
                : check.error}
            </p>
          )}
        </section>
      )}
      <p className="mt-4 text-xs text-muted">
        Els fitxers CSV i Excel es poden tornar a importar. El JSON és la còpia més completa (inclou les dades
        originals d&rsquo;importació). Les fotografies externes només s&rsquo;exporten com a enllaç: no són una còpia de les
        imatges.
      </p>
    </Modal>
  );
}
