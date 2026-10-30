/**
 * Cerca d'imatges a Internet i candidates: desactivada per defecte (les fotos es pugen a mà). Per tornar-la a
 * activar, defineix VITE_ENABLE_IMAGE_SEARCH=true a Vercel i torna a desplegar. No s'ha esborrat cap codi ni dada.
 */
export const imageSearchEnabled = (): boolean => import.meta.env.VITE_ENABLE_IMAGE_SEARCH === 'true';
