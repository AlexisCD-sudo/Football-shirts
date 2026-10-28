import { useState } from 'react';
import {
  CSV_MIME,
  downloadBlob,
  exportFilename,
  shirtsToCsv,
  shirtsToJson,
  shirtsToXlsx,
} from '../lib/export';
import type { Shirt } from '../types/shirt';
import { Modal, buttonCls } from './ui';

export function ExportDialog({ shirts, onClose }: { shirts: Shirt[]; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <p className="mt-4 text-xs text-muted">
        Els fitxers CSV i Excel es poden tornar a importar. El JSON és la còpia més completa (inclou les dades
        originals d&rsquo;importació). Les fotografies externes només s&rsquo;exporten com a enllaç: no són una còpia de les
        imatges.
      </p>
    </Modal>
  );
}
