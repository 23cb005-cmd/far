import { AlertCircle } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

/** The wiring FormField computes and the control must receive. */
export interface ControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  'aria-required'?: true;
}

export interface FormFieldProps {
  /** Must match the control's `id`, so the label actually labels it. */
  id: string;
  label: string;
  /** Validation message. Its presence switches the field into the error state. */
  error?: string;
  /** Static guidance shown under the control when there is no error. */
  hint?: string;
  required?: boolean;
  requiredLabel?: string;
  optionalLabel?: string;
  className?: string;
  /**
   * A single control element, which receives the wiring automatically, or a
   * function that receives it. Use the function form whenever the control is
   * wrapped in markup (a password field with a reveal button, for example):
   * cloning would otherwise put the `id` on the wrapper, and a `<label for>`
   * pointing at a `<div>` labels nothing at all.
   */
  children: React.ReactNode | ((control: ControlProps) => React.ReactNode);
}

/**
 * The single wrapper every form control uses.
 *
 * It owns the accessibility wiring so individual pages cannot forget it:
 * a real `<label for>`, `aria-describedby` pointing at the hint and the error,
 * and `role="alert"` so a screen reader announces a validation failure as soon
 * as it appears.
 */
export function FormField({
  id,
  label,
  error,
  hint,
  required,
  requiredLabel = 'Required',
  optionalLabel,
  className,
  children,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const control: ControlProps = {
    id,
    ...(error ? { 'aria-invalid': true as const } : {}),
    ...(required ? { 'aria-required': true as const } : {}),
  };
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');
  if (describedBy) control['aria-describedby'] = describedBy;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className={cn(error && 'text-destructive')}>
          {label}
          {required ? (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
          {required ? <span className="sr-only"> ({requiredLabel})</span> : null}
        </Label>
        {!required && optionalLabel ? (
          <span className="text-xs text-muted-foreground">{optionalLabel}</span>
        ) : null}
      </div>

      {/*
        A lone element is cloned so simple fields need no boilerplate; anything
        wrapped must use the render-prop form and place the props itself.
      */}
      {typeof children === 'function'
        ? children(control)
        : React.isValidElement(children)
          ? React.cloneElement(
              children as React.ReactElement<Record<string, unknown>>,
              { ...control } as Record<string, unknown>,
            )
          : children}

      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A non-field-specific error, e.g. "Invalid phone or password" from the server. */
export function FormError({ message, className }: { message?: string; className?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-md border border-destructive/30 bg-danger-muted px-3 py-2.5 text-sm text-destructive',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
