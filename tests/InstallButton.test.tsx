import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstallButton } from '../src/components/InstallButton';

afterEach(() => vi.restoreAllMocks());

describe('Botó d’instal·lació', () => {
  it('mostra els passos si el navegador no ofereix el diàleg natiu', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    render(<InstallButton />);
    await user.click(screen.getByRole('button', { name: 'Instal·la l’app' }));
    const dialog = await screen.findByRole('dialog', { name: 'Instal·la l’app' });
    expect(within(dialog).getByText(/Afegeix a la pantalla d’inici/)).toBeInTheDocument();
  });

  it('usa el diàleg natiu quan el navegador l’ofereix', async () => {
    const user = userEvent.setup();
    render(<InstallButton />);
    const prompt = vi.fn().mockResolvedValue(undefined);
    const ev = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    window.dispatchEvent(ev);
    await user.click(screen.getByRole('button', { name: 'Instal·la l’app' }));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('no es mostra si l’app ja està instal·lada', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    render(<InstallButton />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
