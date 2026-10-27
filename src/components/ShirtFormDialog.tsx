import { useId, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  authenticityLabels,
  conditionLabels,
  kitTypeLabels,
  teamKindLabels,
  versionLabels,
} from '../lib/labels';
import {
  emptyFormValues,
  parseShirtForm,
  shirtToFormValues,
  type ShirtFormValues,
} from '../lib/shirtSchema';
import { normalize } from '../lib/catalog';
import {
  AUTHENTICITIES,
  CONDITIONS,
  KIT_TYPES,
  VERSIONS,
  type Shirt,
  type ShirtInput,
  type Team,
} from '../types/shirt';
import { Modal, buttonCls, inputCls, primaryCls } from './ui';

interface Props {
  shirt?: Shirt;
  teams: Team[];
  brands: string[];
  onSubmit: (input: ShirtInput) => Promise<void>;
  onClose: () => void;
}

type Errors = Partial<Record<keyof ShirtFormValues, string>>;

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mt-6 first:mt-0">
      <legend className="mb-3 font-display text-base font-bold">{title}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function ShirtFormDialog({ shirt, teams, brands, onSubmit, onClose }: Props) {
  const uid = useId();
  const [values, setValues] = useState<ShirtFormValues>(shirt ? shirtToFormValues(shirt) : emptyFormValues);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const id = (name: keyof ShirtFormValues) => `${uid}-${name}`;
  const set =
    (name: keyof ShirtFormValues) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value }));

  function onTeamChange(e: ChangeEvent<HTMLInputElement>) {
    const name = e.target.value;
    const known = teams.find((t) => normalize(t.name) === normalize(name));
    setValues((v) => ({
      ...v,
      teamName: name,
      teamKind: known ? known.kind : v.teamKind,
      country: known && known.country && !v.country ? known.country : v.country,
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = parseShirtForm(values);
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

  const text = (name: keyof ShirtFormValues, props: Record<string, unknown> = {}) => (
    <input id={id(name)} className={inputCls} value={values[name]} onChange={set(name)} {...props} />
  );

  return (
    <Modal title={shirt ? 'Edita la samarreta' : 'Nova samarreta'} onClose={onClose} wide>
      <form onSubmit={submit} noValidate>
        <Section title="Identificació">
          <Field label="Equip o selecció" htmlFor={id('teamName')} error={errors.teamName}>
            <input
              id={id('teamName')}
              className={inputCls}
              value={values.teamName}
              onChange={onTeamChange}
              list={`${uid}-teams`}
              autoComplete="off"
              required
            />
            <datalist id={`${uid}-teams`}>
              {teams.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Tipus d'equip" htmlFor={id('teamKind')}>
            <select id={id('teamKind')} className={inputCls} value={values.teamKind} onChange={set('teamKind')}>
              {(Object.keys(teamKindLabels) as (keyof typeof teamKindLabels)[]).map((k) => (
                <option key={k} value={k}>
                  {teamKindLabels[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="País" htmlFor={id('country')} error={errors.country}>
            {text('country')}
          </Field>
          <Field label="Temporada" htmlFor={id('season')} error={errors.season} hint="Format AAAA-AA">
            {text('season', { placeholder: '2010-11', inputMode: 'numeric' })}
          </Field>
          <Field label="Competició" htmlFor={id('competition')} error={errors.competition}>
            {text('competition')}
          </Field>
          <Field label="Equipació" htmlFor={id('kitType')} error={errors.kitType}>
            <select id={id('kitType')} className={inputCls} value={values.kitType} onChange={set('kitType')}>
              <option value="">Desconeguda</option>
              {KIT_TYPES.map((k) => (
                <option key={k} value={k}>
                  {kitTypeLabels[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Jugador" htmlFor={id('playerName')} error={errors.playerName}>
            {text('playerName')}
          </Field>
          <Field label="Dorsal" htmlFor={id('squadNumber')} error={errors.squadNumber}>
            {text('squadNumber', { inputMode: 'numeric' })}
          </Field>
        </Section>

        <Section title="Producte">
          <Field label="Marca" htmlFor={id('brand')} error={errors.brand}>
            <input
              id={id('brand')}
              className={inputCls}
              value={values.brand}
              onChange={set('brand')}
              list={`${uid}-brands`}
              autoComplete="off"
            />
            <datalist id={`${uid}-brands`}>
              {brands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </Field>
          <Field label="Model" htmlFor={id('model')} error={errors.model}>
            {text('model')}
          </Field>
          <Field label="Versió" htmlFor={id('version')}>
            <select id={id('version')} className={inputCls} value={values.version} onChange={set('version')}>
              {VERSIONS.map((k) => (
                <option key={k} value={k}>
                  {versionLabels[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Talla" htmlFor={id('size')} error={errors.size}>
            {text('size')}
          </Field>
          <Field label="Any de fabricació" htmlFor={id('manufactureYear')} error={errors.manufactureYear}>
            {text('manufactureYear', { inputMode: 'numeric' })}
          </Field>
          <Field label="Estat de conservació" htmlFor={id('condition')} error={errors.condition}>
            <select id={id('condition')} className={inputCls} value={values.condition} onChange={set('condition')}>
              <option value="">Desconegut</option>
              {CONDITIONS.map((k) => (
                <option key={k} value={k}>
                  {conditionLabels[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Autenticitat" htmlFor={id('authenticity')}>
            <select
              id={id('authenticity')}
              className={inputCls}
              value={values.authenticity}
              onChange={set('authenticity')}
            >
              {AUTHENTICITIES.map((k) => (
                <option key={k} value={k}>
                  {authenticityLabels[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Procedència" htmlFor={id('provenance')} error={errors.provenance}>
            {text('provenance')}
          </Field>
        </Section>

        <Section title="Compra i ubicació">
          <Field label="Data de compra" htmlFor={id('purchaseDate')} error={errors.purchaseDate}>
            {text('purchaseDate', { type: 'date' })}
          </Field>
          <Field label="Venedor o botiga" htmlFor={id('seller')} error={errors.seller}>
            {text('seller')}
          </Field>
          <Field label="Preu (€)" htmlFor={id('price')} error={errors.price}>
            {text('price', { inputMode: 'decimal' })}
          </Field>
          <Field label="Enviament (€)" htmlFor={id('shippingCost')} error={errors.shippingCost}>
            {text('shippingCost', { inputMode: 'decimal' })}
          </Field>
          <Field label="Valor estimat (€)" htmlFor={id('estimatedValue')} error={errors.estimatedValue}>
            {text('estimatedValue', { inputMode: 'decimal' })}
          </Field>
          <Field label="Ubicació física" htmlFor={id('location')} error={errors.location}>
            {text('location')}
          </Field>
        </Section>

        <Section title="Notes">
          <div className="sm:col-span-2">
            <Field label="Observacions" htmlFor={id('notes')} error={errors.notes}>
              <textarea id={id('notes')} className={inputCls} rows={3} value={values.notes} onChange={set('notes')} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Curiositats" htmlFor={id('curiosities')} error={errors.curiosities}>
              <textarea
                id={id('curiosities')}
                className={inputCls}
                rows={2}
                value={values.curiosities}
                onChange={set('curiosities')}
              />
            </Field>
          </div>
        </Section>

        {formError && (
          <p role="alert" className="mt-4 rounded-md border border-red-700/40 p-3 text-sm text-red-700 dark:text-red-400">
            {formError}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
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
