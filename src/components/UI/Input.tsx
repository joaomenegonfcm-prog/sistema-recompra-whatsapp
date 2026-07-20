import { useId, type InputHTMLAttributes, type ReactNode, type WheelEvent } from 'react';
import clsx from 'clsx';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helpText?: ReactNode;
  errorMessage?: ReactNode;
};

export function Input({
  className,
  id,
  label,
  onWheel,
  helpText,
  errorMessage,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helpId = helpText ? `${inputId}-help` : undefined;
  const errorId = errorMessage ? `${inputId}-error` : undefined;
  const describedBy = [ariaDescribedBy, helpId, errorId].filter(Boolean).join(' ') || undefined;
  const invalid = errorMessage ? true : ariaInvalid;

  function handleWheel(event: WheelEvent<HTMLInputElement>) {
    if (event.currentTarget.type === 'number') {
      event.currentTarget.blur();
    }

    onWheel?.(event);
  }

  return (
    <label className="field" htmlFor={inputId}>
      {label && <span>{label}</span>}
      <input
        id={inputId}
        className={clsx('input', className)}
        onWheel={handleWheel}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        {...props}
      />
      {helpText && (
        <span id={helpId} className="field-help">
          {helpText}
        </span>
      )}
      {errorMessage && (
        <span id={errorId} className="field-error">
          {errorMessage}
        </span>
      )}
    </label>
  );
}
