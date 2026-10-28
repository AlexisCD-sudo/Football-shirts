import { formatDate, formatMoney } from '../lib/format';
import { authenticityLabels, conditionLabels, kitTypeLabels, teamKindLabels, versionLabels } from '../lib/labels';
import type { Shirt } from '../types/shirt';
import { ShirtPlaceholder } from './ShirtPlaceholder';
import { Modal, buttonCls, primaryCls } from './ui';

interface Props {
  shirt: Shirt;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ShirtDetailDialog({ shirt: s, onEdit, onDelete, onClose }: Props) {
  const rows: [string, string | null][] = [
    ['Tipus', teamKindLabels[s.team.kind]],
    ['País', s.team.country],
    ['Temporada', s.season],
    ['Competició', s.competition],
    ['Equipació', s.kitType ? kitTypeLabels[s.kitType] : null],
    ['Marca', s.brand],
    ['Model', s.model],
    ['Versió', s.version === 'unknown' ? null : versionLabels[s.version]],
    ['Jugador', s.playerName],
    ['Dorsal', s.squadNumber !== null ? String(s.squadNumber) : null],
    ['Talla', s.size],
    ['Any de fabricació', s.manufactureYear !== null ? String(s.manufactureYear) : null],
    ['Estat', s.condition ? conditionLabels[s.condition] : null],
    ['Autenticitat', s.authenticity === 'unverified' ? null : authenticityLabels[s.authenticity]],
    ['Procedència', s.provenance],
    ['Data de compra', formatDate(s.purchaseDate)],
    ['Venedor', s.seller],
    ['Preu', formatMoney(s.price)],
    ['Enviament', formatMoney(s.shippingCost)],
    ['Valor estimat', formatMoney(s.estimatedValue)],
    ['Ubicació', s.location],
    ['Observacions', s.notes],
    ['Curiositats', s.curiosities],
  ];
  const known = rows.filter((r): r is [string, string] => r[1] !== null);

  return (
    <Modal title={s.team.name} onClose={onClose} wide>
      <div className="grid gap-5 sm:grid-cols-[14rem_1fr]">
        <div className="aspect-[4/5] overflow-hidden rounded-xl border border-line">
          {s.photoUrl ? (
            <img src={s.photoUrl} alt={`Samarreta ${s.team.name}`} className="h-full w-full object-cover" />
          ) : (
            <ShirtPlaceholder shirt={s} />
          )}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {known.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="whitespace-pre-wrap">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-line pt-4">
        <button type="button" className={buttonCls} onClick={onDelete}>
          Elimina
        </button>
        <button type="button" className={primaryCls} onClick={onEdit}>
          Edita
        </button>
      </div>
    </Modal>
  );
}
