import { useEffect, useState } from 'react';
import { Modal, buttonCls } from './ui';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

type Platform = 'ios' | 'android' | 'desktop';

function platform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS es presenta com a Mac amb pantalla tàctil.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

const steps: Record<Platform, string[]> = {
  ios: [
    'Obre aquesta pàgina a Safari (o Chrome).',
    'Toca el botó Compartir (el quadrat amb una fletxa cap amunt), a la barra de baix o de dalt.',
    'Fes lliscar el menú cap amunt i tria «Afegeix a la pantalla d’inici». Si no la veus, toca «Edita les accions» o «Més».',
    'Toca «Afegeix». Ja tindràs la icona com una app.',
  ],
  android: [
    'Obre aquesta pàgina a Chrome.',
    'Toca el menú ⋮ (a dalt a la dreta).',
    'Tria «Instal·la l’aplicació» o «Afegeix a la pantalla d’inici».',
    'Confirma. Ja tindràs la icona com una app.',
  ],
  desktop: [
    'A Chrome o Edge, busca la icona d’instal·lar a la dreta de la barra d’adreces.',
    'O obre el menú ⋮ → «Instal·la Football Shirt Collection».',
  ],
};

/** Botó «Instal·la l'app»: usa el diàleg natiu quan el navegador el ofereix i, si no, mostra els passos. */
export function InstallButton() {
  const [standalone] = useState(isStandalone);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (standalone) return null;

  async function install() {
    if (!prompt) {
      setHelp(true);
      return;
    }
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } finally {
      setPrompt(null);
    }
  }

  const p = platform();
  return (
    <>
      <button type="button" className={buttonCls} onClick={() => void install()}>
        Instal·la l&rsquo;app
      </button>
      {help && (
        <Modal title="Instal·la l’app" onClose={() => setHelp(false)}>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {steps[p].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted">
            Només es pot instal·lar des de l&rsquo;adreça oficial de la web (https), no des d&rsquo;una adreça de previsualització.
          </p>
        </Modal>
      )}
    </>
  );
}
