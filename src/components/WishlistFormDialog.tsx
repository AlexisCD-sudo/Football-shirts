import { useId, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { normalize } from '../lib/catalog';
import { kitTypeLabels, teamKindLabels } from '../lib/labels';
import {
  emptyWishlistValues,
  parseWishlistForm,
  wishlistToFormValues,
  type WishlistFormValues,
} from '../lib/wishlistSchema';
import { KIT_TYPES, type Team, type WishlistInput, type WishlistItem } from '../types/shirt';
import { Modal, buttonCls, inputCls, primaryCls } from './ui';
import { wishlistStatusLabels } from '../lib/wishlistLabels';
import { WISHLIST_STATUSES } from '../types/shirt';

interface Props {
  item?: WishlistItem;
  teams: Team[];
  onSubmit: (input: WishlistInput) => Promise<void>;
  onClose: () => void;
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function WishlistFormDialog({ item, teams, onSubmit, onClose }: Props) {
  const uid = useId();
  const [values, setValues] = useState<WishlistFormValues>(item ? wishlistToFormValues(item) : emptyWishlistValues);
  const [errors, setErrors] = useState<Partial<Record<keyof WishlistFormValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = (n: keyof WishlistFormValues) => `${uid}-${n}`;
  const set = (n: keyof WishlistFormValues) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [n]: e.target.value }));

  function onTeamChange(e: ChangeEvent<HTMLInputElement>) {
    const name = e.target.value;
    const known = teams.find((t) => normalize(t.name) === normalize(name));
    setValues((v) => ({
      ...v,
      teamName: name,
      teamKind: known ? known.kind : v.teamKind,
      country: known?.country && !v.country ? known.country : v.country,
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = parseWishlistForm(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No s’ha pogut desar. Torna-ho a provar.');
      setSaving(false);
    }
  }

  return (
    <Modal title={item ? 'Edita el desig' : 'Nou desig'} onClose={onClose} wide>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Equip o selecció" htmlFor={id('teamName')} error={errors.teamName}>
            <input id={id('teamName')} list={`${uid}-teams`} className={inputCls} value={values.teamName} onChange={onTeamChange} />
            <datalist id={`${uid}-teams`}>
              {teams.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Tipus" htmlFor={id('teamKind')}>
            <select id={id('teamKind')} className={inputCls} value={values.teamKind} onChange={set('teamKind')}>
              {(['club', 'national'] as const).map((k) => (
                <option key={k} value={k}>
                  {teamKindLabels[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="País" htmlFor={id('country')}>
            <input id={id('country')} className={inputCls} value={values.country} onChange={set('country')} />
          </Field>
          <Field label="Temporada" htmlFor={id('season')} error={errors.season}>
            <input id={id('season')} className={inputCls} placeholder="2005-06" value={values.season} onChange={set('season')} />
          </Field>
          <Field label="Equipació" htmlFor={id('kitType')} error={errors.kitType}>
            <select id={id('kitType')} className={inputCls} value={values.kitType} onChange={set('kitType')}>
              <option value="">Sense especificar</option>
              {KIT_TYPES.map((k) => (
                <option key={k} value={k}>
                  {kitTypeLabels[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Jugador" htmlFor={id('playerName')}>
            <input id={id('playerName')} className={inputCls} value={values.playerName} onChange={set('playerName')} />
          </Field>
          <Field label="Prioritat (1 = màxima)" htmlFor={id('priority')} error={errors.priority}>
            <select id={id('priority')} className={inputCls} value={values.priority} onChange={set('priority')}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Preu màxim (€)" htmlFor={id('maxPrice')} error={errors.maxPrice}>
            <input id={id('maxPrice')} inputMode="decimal" className={inputCls} value={values.maxPrice} onChange={set('maxPrice')} />
          </Field>
          <Field label="Estat" htmlFor={id('status')} error={errors.status}>
            <select id={id('status')} className={inputCls} value={values.status} onChange={set('status')}>
              {WISHLIST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {wishlistStatusLabels[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Enllaç de compra" htmlFor={id('purchaseUrl')} error={errors.purchaseUrl}>
            <input id={id('purchaseUrl')} type="url" className={inputCls} value={values.purchaseUrl} onChange={set('purchaseUrl')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Imatge de referència (enllaç)" htmlFor={id('referenceImageUrl')} error={errors.referenceImageUrl}>
              <input id={id('referenceImageUrl')} type="url" className={inputCls} value={values.referenceImageUrl} onChange={set('referenceImageUrl')} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes" htmlFor={id('notes')}>
              <textarea id={id('notes')} rows={3} className={inputCls} value={values.notes} onChange={set('notes')} />
            </Field>
          </div>
        </div>
        {formError && (
          <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
            {formError}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={buttonCls} onClick={onClose} disabled={saving}>
            Cancel·la
          </button>
          <button type="submit" className={primaryCls} disabled={saving}>
            {saving ? 'Desant…' : 'Desa'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
