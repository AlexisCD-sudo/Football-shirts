import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../src/pages/LoginPage';

describe('LoginPage', () => {
  it('no crida l’inici de sessió si falten dades', async () => {
    const onSignIn = vi.fn();
    render(<LoginPage onSignIn={onSignIn} />);
    await userEvent.click(screen.getByRole('button', { name: 'Entra' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Introdueix el correu i la contrasenya.');
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it('envia el correu i la contrasenya', async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    render(<LoginPage onSignIn={onSignIn} />);
    await userEvent.type(screen.getByLabelText('Correu electrònic'), ' jo@exemple.cat ');
    await userEvent.type(screen.getByLabelText('Contrasenya'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Entra' }));
    expect(onSignIn).toHaveBeenCalledWith('jo@exemple.cat', 'secret');
  });

  it('mostra l’error i permet tornar-ho a provar', async () => {
    const onSignIn = vi.fn().mockRejectedValue(new Error('Correu o contrasenya incorrectes.'));
    render(<LoginPage onSignIn={onSignIn} />);
    await userEvent.type(screen.getByLabelText('Correu electrònic'), 'a@b.cat');
    await userEvent.type(screen.getByLabelText('Contrasenya'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Entra' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Correu o contrasenya incorrectes.');
    expect(screen.getByRole('button', { name: 'Entra' })).toBeEnabled();
  });
});
