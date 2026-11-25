import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export const inputClassName =
  "block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 shadow-sm " +
  "placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 " +
  "disabled:cursor-not-allowed disabled:bg-slate-100 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-200";

interface BaseProps {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
}

function Help({ id, error, hint }: { id: string; error?: string; hint?: ReactNode }) {
  if (error) {
    return (
      <p id={`${id}-help`} className="text-sm text-red-600">
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={`${id}-help`} className="text-sm text-slate-500">
        {hint}
      </p>
    );
  }
  return null;
}

export function Field({ label, name, error, hint, id, ...props }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const inputId = id ?? name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${inputId}-help` : undefined}
        className={inputClassName}
        {...props}
      />
      <Help id={inputId} error={error} hint={hint} />
    </div>
  );
}

export function SelectField({
  label,
  name,
  error,
  hint,
  id,
  children,
  ...props
}: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const inputId = id ?? name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${inputId}-help` : undefined}
        className={inputClassName}
        {...props}
      >
        {children}
      </select>
      <Help id={inputId} error={error} hint={hint} />
    </div>
  );
}

export function TextareaField({
  label,
  name,
  error,
  hint,
  id,
  ...props
}: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const inputId = id ?? name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${inputId}-help` : undefined}
        className={inputClassName}
        {...props}
      />
      <Help id={inputId} error={error} hint={hint} />
    </div>
  );
}

export function CheckboxField({ label, name, defaultChecked, hint }: { label: string; name: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-5 accent-emerald-600" />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}
