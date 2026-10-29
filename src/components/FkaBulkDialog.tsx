import { useMemo, useState } from 'react';
import { FKA_HOME, FKA_LICENSE, FKA_SOURCE } from '../lib/fka';
import { extractFkaLinks, matchLinksToShirts, type Group, type ShirtMatch } from '../lib/fkaMatch';
import { kitTypeLabels } from '../lib/labels';
import type { Shirt } from '../types/shirt';
import { Modal, buttonCls, primaryCls } from './ui';

interface Props {
  shirts: Shirt[];
  addImage: (shirtId: string, imageUrl: string, pageUrl?: string) => Promise<void>;
  onDone: (applied: number) => void;
  onSingle: () => void;
  onClose: () => void;
}

const describe = (s: Shirt) => `${s.team.name} · ${s.season ?? '—'} · ${s.kitType ? kitTypeLabels[s.kitType] : '—'}`;
const groupText = (g: Group) => `${g.teamTokens.join(' ')} · ${g.season}${g.kitType ? ` · ${kitTypeLabels[g.kitType]}` : ''}`;

function Thumb({ url }: { url: string | null }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="h-14 w-12 shrink-0 overflow-hidden rounded border border-line bg-card">
      {url && !broken ? (
        <img src={url} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="block p-1 text-[10px] text-muted">sense vista</span>
      )}
    </div>
  );
}

export function FkaBulkDialog({ shirts, addImage, onDone, onSingle, onClose }: Props) {
  const [text, setText] = useState('');
  const [analysed, setAnalysed] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  const report = useMemo(() => (analysed === null ? null : matchLinksToShirts(extractFkaLinks(analysed), shirts)), [analysed, shirts]);

  function analyse() {
    const r = matchLinksToShirts(extractFkaLinks(text), shirts);
    setAnalysed(text);
    // Només es preselecciona el que és exacte i sense ambigüitat.
    setPicked(Object.fromEntries(r.matches.map((m) => [m.shirt.id, m.level === 'exact'])));
    setChoice({});
    setErrors([]);
  }

  const chosen: ShirtMatch[] = report
    ? [
        ...report.matches.filter((m) => picked[m.shirt.id]),
        ...report.conflicts.flatMap((c) => {
          const k = choice[c.shirt.id];
          const g = c.options.find((o) => o.key === k);
          return g ? [{ shirt: c.shirt, level: 'probable' as const, group: g, reason: 'triat per tu' }] : [];
        }),
      ]
    : [];

  async function apply() {
    setBusy(true);
    setErrors([]);
    setProgress(0);
    const failed: string[] = [];
    let ok = 0;
    for (const m of chosen) {
      try {
        if (m.group.imageUrl) await addImage(m.shirt.id, m.group.imageUrl, m.group.pageUrl ?? undefined);
        ok += 1;
      } catch (e) {
        failed.push(`${describe(m.shirt)}: ${e instanceof Error ? e.message : 'error'}`);
      }
      setProgress((p) => p + 1);
    }
    setBusy(false);
    if (failed.length) {
      setErrors(failed);
      if (ok) onDone(ok);
      return;
    }
    onDone(ok);
    onClose();
  }

  return (
    <Modal title="Enllaça imatges de Football Kit Archive" onClose={onClose} wide>
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Enganxa aquí <strong>moltes adreces de cop</strong> (d&rsquo;imatges com <code>…/camiseta-local-borussia-dortmund-2016-17.jpg</code> o de fitxes) o fins i tot el codi font d&rsquo;una pàgina de FKA que hagis obert tu. L&rsquo;app llegeix el <em>nom</em> de cada enllaç, el compara amb les teves samarretes (equip, temporada i equipació) i només preselecciona les coincidències exactes. No consulta ni descarrega res de FKA.
        </p>
        <a href={FKA_HOME} target="_blank" rel="noopener noreferrer" className={buttonCls}>
          Obre Football Kit Archive ↗
        </a>
        <label className="block font-semibold">
          Enllaços enganxats
          <textarea
            aria-label="Enllaços de Football Kit Archive"
            className="mt-1 block h-32 w-full rounded-lg border border-line bg-card p-2 font-mono text-xs"
            placeholder="https://www.footballkitarchive.com/cdn/2019/06/…/camiseta-local-borussia-dortmund-2016-17.jpg"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryCls} disabled={!text.trim() || busy} onClick={analyse}>
            Analitza i busca coincidències
          </button>
          <button type="button" className={buttonCls} onClick={onSingle}>
            Una sola samarreta (pas a pas)
          </button>
        </div>

        {report && (
          <section aria-label="Resultat de l’anàlisi" className="space-y-3">
            <p role="status">
              S&rsquo;han trobat <strong>{report.images}</strong> imatges i <strong>{report.pages}</strong> fitxes de FKA ({report.groups} samarretes diferents).{' '}
              <strong>{report.matches.length}</strong> coincideixen amb la teva col·lecció
              {report.conflicts.length ? `, ${report.conflicts.length} amb dubte` : ''}
              {report.protectedCount ? `; ${report.protectedCount} ja tenen foto i no es toquen` : ''}.
            </p>
            {report.totalLinks === 0 && (
              <p className="text-muted">No he trobat cap enllaç útil: cal que siguin adreces de footballkitarchive.com amb el nom de la samarreta (equip i temporada).</p>
            )}

            {report.matches.length > 0 && (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {report.matches.map((m) => (
                  <li key={m.shirt.id} className="flex items-center gap-3 p-2">
                    <input
                      type="checkbox"
                      aria-label={`Aplica a ${describe(m.shirt)}`}
                      checked={!!picked[m.shirt.id]}
                      onChange={(e) => setPicked({ ...picked, [m.shirt.id]: e.target.checked })}
                    />
                    <Thumb url={m.group.imageUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{describe(m.shirt)}</p>
                      <p className="truncate text-xs text-muted">
                        {m.level === 'exact' ? 'Coincidència exacta' : 'Probable'} · enllaç: {groupText(m.group)}
                        {m.level === 'probable' ? ` (${m.reason})` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {report.conflicts.length > 0 && (
              <div>
                <p className="font-semibold">Amb dubte: tria quina imatge és</p>
                <ul className="mt-1 space-y-2">
                  {report.conflicts.map((c) => (
                    <li key={c.shirt.id} className="rounded-lg border border-line p-2">
                      <p className="font-medium">{describe(c.shirt)}</p>
                      <select
                        aria-label={`Imatge per a ${describe(c.shirt)}`}
                        className="mt-1 w-full rounded border border-line bg-card p-1 text-xs"
                        value={choice[c.shirt.id] ?? ''}
                        onChange={(e) => setChoice({ ...choice, [c.shirt.id]: e.target.value })}
                      >
                        <option value="">— cap —</option>
                        {c.options.map((o) => (
                          <option key={o.key} value={o.key}>
                            {groupText(o)}
                            {o.variant ? ' (variant)' : ''}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(report.withoutMatch.length > 0 || report.unusedGroups.length > 0) && (
              <details className="text-xs text-muted">
                <summary className="cursor-pointer">
                  Sense coincidència: {report.withoutMatch.length} samarretes, {report.unusedGroups.length} enllaços
                </summary>
                {report.withoutMatch.length > 0 && <p className="mt-1">Samarretes: {report.withoutMatch.map(describe).join(' | ')}</p>}
                {report.unusedGroups.length > 0 && <p className="mt-1">Enllaços: {report.unusedGroups.map(groupText).join(' | ')}</p>}
              </details>
            )}

            {errors.length > 0 && (
              <div role="alert" className="text-xs text-red-700 dark:text-red-400">
                <p>No s&rsquo;han pogut aplicar:</p>
                <ul className="list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              {busy && <span className="text-xs text-muted">{progress}/{chosen.length}…</span>}
              <button type="button" className={buttonCls} onClick={onClose} disabled={busy}>
                Tanca
              </button>
              <button type="button" className={primaryCls} disabled={busy || chosen.length === 0} onClick={apply}>
                Aplica {chosen.length} seleccionades
              </button>
            </div>
            <p className="text-xs text-muted">
              Es desa l&rsquo;adreça de la imatge (com a candidata confirmada, amb font «{FKA_SOURCE}» i «{FKA_LICENSE}»). Si el web d&rsquo;origen bloqueja mostrar-la, usa «Una sola samarreta» i puja el fitxer.
            </p>
          </section>
        )}
      </div>
    </Modal>
  );
}
