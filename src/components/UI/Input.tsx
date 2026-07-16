import type { InputHTMLAttributes, WheelEvent } from 'react';
import clsx from 'clsx';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function Input({ className, id, label, onWheel, ...props }: InputProps) {
  function handleWheel(event: WheelEvent<HTMLInputElement>) {
    if (event.currentTarget.type === 'number') {
      event.currentTarget.blur();
    }

    onWheel?.(event);
  }

  return (
    <label className="field" htmlFor={id}>
      {label && <span>{label}</span>}
      <input id={id} className={clsx('input', className)} onWheel={handleWheel} {...props} />
    </label>
  );
}
