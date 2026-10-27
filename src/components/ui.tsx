import { useEffect, useRef, type ReactNode } from 'react';

export const inputCls =
  'w-full rounded-md border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-2 focus:outline-offset-1 focus:outline-accent';

export const buttonCls =
  'inline-flex items-center justify-center gap-2 rounded-md border border-line bg-card px-3.5 py-2 text-sm font-medium text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed';

export const primaryCls =
  'inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed';

export function Spinner({ label = 'Carregant…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-20 text-muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

/** Diàleg modal accessible: Escape tanca, el focus hi entra i el fons no es desplaça. */
export function Modal({ title, onClose, children, wide }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-paper shadow-2xl outline-none sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper px-5 py-3">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} className={buttonCls} aria-label="Tanca">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmProps {
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, busy, error, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-muted">{message}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={buttonCls} onClick={onCancel} disabled={busy}>
          Cancel·la
        </button>
        <button type="button" className={primaryCls} onClick={onConfirm} disabled={busy}>
          {busy ? 'Un moment…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
