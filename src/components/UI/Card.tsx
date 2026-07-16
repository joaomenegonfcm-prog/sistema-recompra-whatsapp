import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div className={clsx('card', className)} {...props}>
      {children}
    </div>
  );
}
