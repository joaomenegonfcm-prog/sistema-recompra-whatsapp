import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

type ModalProps = {
  children: ReactNode;
  isOpen: boolean;
  title: string;
  onClose: () => void;
};

export function Modal({ children, isOpen, onClose, title }: ModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <Button type="button" variant="ghost" onClick={onClose} aria-label="Fechar modal">
            <X size={18} aria-hidden="true" />
          </Button>
        </header>
        {children}
      </section>
    </div>
  );
}
