import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sense `globals: true`, Testing Library no neteja el DOM sol entre proves.
afterEach(() => {
  cleanup();
  try {
    localStorage.clear(); // la secció i la vista es recorden a localStorage: cada prova comença neta
  } catch {
    /* ignorat */
  }
});
