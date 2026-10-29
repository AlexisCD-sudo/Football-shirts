import { useState } from 'react';
import type { Shirt } from '../types/shirt';
import { ShirtPlaceholder } from './ShirtPlaceholder';

/** Foto de la samarreta; si la imatge externa ja no existeix o no carrega, mostra el marcador de posició. */
export function ShirtPhoto({ shirt, eager }: { shirt: Shirt; eager?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!shirt.photoUrl || failed === shirt.photoUrl) return <ShirtPlaceholder shirt={shirt} />;
  return (
    <img
      src={shirt.photoUrl}
      alt={`Samarreta ${shirt.team.name} ${shirt.season ?? ''}`.trim()}
      loading={eager ? 'eager' : 'lazy'}
      referrerPolicy="no-referrer"
      className="h-full w-full object-cover"
      onError={() => setFailed(shirt.photoUrl)}
    />
  );
}
