export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024;
export const MAX_SIDE = 1600;
const KEEP_ORIGINAL_BELOW = 1.5 * 1024 * 1024;

/** Retorna un missatge d'error si el fitxer no és admissible, o `null` si és correcte. */
export function validatePhotoFile(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return 'Format no admès: usa JPG, PNG o WebP.';
  if (file.size === 0) return 'El fitxer està buit.';
  if (file.size > MAX_ORIGINAL_BYTES) return 'La imatge pesa més de 15 MB. Tria’n una de més petita.';
  return null;
}

/** Mida resultant mantenint la proporció, sense ampliar mai. */
export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export interface PreparedPhoto {
  blob: Blob;
  contentType: string;
}

/**
 * Redimensiona (costat màxim 1600 px) i recomprimeix en JPEG perquè la foto no ocupi la quota gratuïta.
 * Si el navegador no ho pot fer, o la foto ja és petita, es puja l'original.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const original: PreparedPhoto = { blob: file, contentType: file.type };
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return original;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const needsResize = width < bitmap.width || height < bitmap.height;
    if (!needsResize && file.size <= KEEP_ORIGINAL_BELOW) {
      bitmap.close?.();
      return original;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.fillStyle = '#ffffff'; // els PNG transparents no es tornen negres en JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return needsResize && blob ? { blob, contentType: 'image/jpeg' } : original;
    return { blob, contentType: 'image/jpeg' };
  } catch {
    return original;
  }
}
