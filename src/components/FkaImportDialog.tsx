import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { FKA_HOME, isFkaUrl, isHttpUrl, parseFkaKitUrl } from '../lib/fka';
import { ACCEPTED_TYPES, validatePhotoFile } from '../lib/photoUpload';
import type { ShirtFormValues } from '../lib/shirtSchema';
import { kitTypeLabels } from '../lib/labels';
import { Modal, buttonCls, inputCls, primaryCls } from './ui';

/** Dades recollides a la primera pantalla; el formulari de samarreta les completa i les valida. */
export interface FkaDraft {
  pageUrl: string;
  imageUrl: string | null;
  file: File | null;
  initial: Partial<ShirtFormValues>;
}

export function buildDraft(input: { pageUrl: string; imageUrl: string; file: File | null; sponsor: string }): FkaDraft {
  const pageUrl = input.pageUrl.trim();
  const s = parseFkaKitUrl(pageUrl);
  const initial: Partial<ShirtFormValues> = {
    // Procedència: sempre queda l'enllaç original, encara que s'hagi pujat un fitxer.
    provenance: `${isFkaUrl(pageUrl) ? 'Football Kit Archive' : 'Font externa'}: ${pageUrl}`,
  };
  if (s.teamName) initial.teamName = s.teamName;
  if (s.season) initial.season = s.season;
  if (s.kitType) initial.kitType = s.kitType;
  if (input.sponsor.trim()) initial.notes = `Patrocinador: ${input.sponsor.trim()}`;
  return { pageUrl, imageUrl: input.imageUrl.trim() || null, file: input.file, initial };
}

interface Props {
  onContinue: (draft: FkaDraft) => void;
  onClose: () => void;
}

export function FkaImportDialog({ onContinue, onClose }: Props) {
  const uid = useId();
  const [pageUrl, setPageUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sponsor, setSponsor] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imgBroken, setImgBroken] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const suggestion = useMemo(() => (isHttpUrl(pageUrl) ? parseFkaKitUrl(pageUrl) : null), [pageUrl]);
  const fka = isFkaUrl(pageUrl);

  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== 'function') {
      setFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL?.(url);
  }, [file]);

  const preview = file ? filePreview : isHttpUrl(imageUrl) ? imageUrl.trim() : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isHttpUrl(pageUrl)) {
      setError('Enganxa l’enllaç de la fitxa (ha de començar per https://).');
      return;
    }
    if (imageUrl.trim() && !isHttpUrl(imageUrl)) {
      setError('L’enllaç de la imatge ha de començar per http:// o https://');
      return;
    }
    if (file) {
      const problem = validatePhotoFile(file);
      if (problem) {
        setError(problem);
        return;
      }
    }
    onContinue(buildDraft({ pageUrl, imageUrl: file ? '' : imageUrl, file, sponsor }));
  }

  return (
    <Modal title="Afegeix des de Football Kit Archive" onClose={onClose} wide>
      <form onSubmit={submit} noValidate>
        <ol className="space-y-4 text-sm">
          <li>
            <p className="font-semibold">1. Troba la samarreta</p>
            <p className="mt-1 text-muted">
              Football Kit Archive no ofereix cap API i bloqueja l&rsquo;accés automàtic, així que la cerca la fas tu al seu web. Obre la fitxa de la samarreta que vols.
            </p>
            <a href={FKA_HOME} target="_blank" rel="noopener noreferrer" className={`${buttonCls} mt-2`}>
              Obre Football Kit Archive ↗
            </a>
          </li>
          <li>
            <label htmlFor={`${uid}-page`} className="font-semibold">
              2. Enganxa l&rsquo;enllaç de la fitxa
            </label>
            <input
              id={`${uid}-page`}
              type="url"
              inputMode="url"
              placeholder="https://www.footballkitarchive.com/…"
              className={`${inputCls} mt-1`}
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
            />
            {pageUrl.trim() && isHttpUrl(pageUrl) && !fka && (
              <p className="mt-1 text-xs text-muted">Aquest enllaç no és de Football Kit Archive; es desarà com a font externa.</p>
            )}
            {suggestion && (suggestion.teamName || suggestion.season || suggestion.kitType) && (
              <p className="mt-1 text-xs text-muted" role="note">
                Suggeriment a partir del text de l&rsquo;enllaç (no és una coincidència verificada; ho revisaràs al pas 4):{' '}
                <strong>
                  {[suggestion.teamName, suggestion.season, suggestion.kitType ? kitTypeLabels[suggestion.kitType] : null].filter(Boolean).join(' · ')}
                </strong>
              </p>
            )}
          </li>
          <li>
            <p className="font-semibold">3. Afegeix la imatge (opcional)</p>
            <p className="mt-1 text-muted">
              Tria <strong>una</strong> via. El més fiable és <strong>baixar la imatge i pujar-la</strong> (queda al teu espai privat). També pots enganxar l&rsquo;adreça directa de la imatge, però el web d&rsquo;origen pot bloquejar que es mostri aquí.
            </p>
            <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-muted">
              Puja la imatge
              <input
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                aria-label="Puja la imatge"
                className="mt-1 block w-full text-sm normal-case"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setImgBroken(false);
                }}
              />
            </label>
            <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-muted">
              …o adreça de la imatge
              <input
                type="url"
                inputMode="url"
                aria-label="Adreça de la imatge"
                placeholder="https://…"
                className={`${inputCls} mt-1 normal-case`}
                value={imageUrl}
                disabled={!!file}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImgBroken(false);
                }}
              />
            </label>
            {preview && (
              <div className="mt-3 flex items-start gap-3">
                <div className="h-32 w-28 shrink-0 overflow-hidden rounded-lg border border-line bg-card">
                  {imgBroken ? (
                    <p className="p-2 text-xs text-muted">No es pot mostrar</p>
                  ) : (
                    <img src={preview} alt="Previsualització" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={() => setImgBroken(true)} />
                  )}
                </div>
                {imgBroken && (
                  <p className="text-xs text-red-700 dark:text-red-400" role="alert">
                    El web d&rsquo;origen no deixa mostrar aquesta imatge aquí. Baixa-la i puja-la com a fitxer.
                  </p>
                )}
              </div>
            )}
          </li>
          <li>
            <label htmlFor={`${uid}-sponsor`} className="font-semibold">
              Patrocinador (opcional)
            </label>
            <input id={`${uid}-sponsor`} className={`${inputCls} mt-1`} value={sponsor} onChange={(e) => setSponsor(e.target.value)} />
            <p className="mt-1 text-xs text-muted">Es desa a les observacions.</p>
          </li>
        </ol>
        <p className="mt-4 text-xs text-muted">
          Es desen l&rsquo;enllaç original (a «Procedència») i la nota «{`Ús personal (permís assumit pel propietari)`}». Al pas 4 pots corregir totes les dades abans de desar.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={buttonCls} onClick={onClose}>
            Cancel·la
          </button>
          <button type="submit" className={primaryCls}>
            Continua: revisa les dades
          </button>
        </div>
      </form>
    </Modal>
  );
}
