import type { WishlistStatus } from '../types/shirt';

export const wishlistStatusLabels: Record<WishlistStatus, string> = {
  wanted: 'Vull',
  watching: 'En seguiment',
  acquired: 'Adquirida',
  dropped: 'Descartada',
};
