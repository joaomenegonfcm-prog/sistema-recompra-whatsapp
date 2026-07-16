import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function Button({ children, className, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button className={clsx('button', `button-${variant}`, className)} {...props}>
      {children}
    </button>
  );
}
