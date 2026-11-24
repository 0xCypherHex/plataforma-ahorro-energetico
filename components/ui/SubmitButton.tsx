"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { primaryButtonClassName } from "./styles";

export function SubmitButton({
  children,
  pendingText = "Procesando…",
  className = "",
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={`${primaryButtonClassName} ${className}`}>
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {pending ? pendingText : children}
    </button>
  );
}
