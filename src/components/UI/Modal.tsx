import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

type ModalProps = {
  children: ReactNode;
  isOpen: boolean;
  preventClose?: boolean;
  title: string;
  onClose: () => void;
};

const focusableSelector = [
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isFocusable(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  return element.getAttribute('aria-hidden') !== 'true' && element.tabIndex !== -1;
}

export function Modal({
  children,
  isOpen,
  onClose,
  preventClose = false,
  title,
}: ModalProps) {
  const titleId = useId();
  const modalRef = useRef<HTMLElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const modalElement = modalRef.current;
    const firstFocusable = modalElement
      ? Array.from(modalElement.querySelectorAll(focusableSelector)).find(isFocusable)
      : null;

    window.setTimeout(() => {
      (firstFocusable ?? modalElement)?.focus();
    }, 0);

    return () => {
      const previouslyFocusedElement = previouslyFocusedElementRef.current;

      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && !preventClose) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, preventClose]);

  function handleCloseClick() {
    if (preventClose) return;
    onClose();
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;

    const modalElement = modalRef.current;
    if (!modalElement) return;

    const focusableElements = Array.from(
      modalElement.querySelectorAll(focusableSelector),
    ).filter(isFocusable);

    if (focusableElements.length === 0) {
      event.preventDefault();
      modalElement.focus();
      return;
    }

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
    } else if (!event.shiftKey && document.activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleDialogKeyDown}
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <Button
            type="button"
            variant="ghost"
            onClick={handleCloseClick}
            aria-label="Fechar modal"
            disabled={preventClose}
          >
            <X size={18} aria-hidden="true" />
          </Button>
        </header>
        {children}
      </section>
    </div>
  );
}
