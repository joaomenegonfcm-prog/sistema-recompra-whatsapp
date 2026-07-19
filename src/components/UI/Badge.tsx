import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

export type BadgeVariant =
  | 'default'
  | 'active'
  | 'in_followup'
  | 'repurchased'
  | 'paused'
  | 'cancelled'
  | 'opt_out';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: BadgeVariant;
};

export function Badge({ children, className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span className={clsx('badge', `badge-${variant}`, className)} {...props}>
      {children}
    </span>
  );
}
