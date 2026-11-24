"use client";

import { useActionState } from "react";
import { login } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/Alert";
import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialFormState } from "@/lib/forms";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(login, initialFormState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message && <Alert variant={state.status === "success" ? "success" : "error"}>{state.message}</Alert>}

      <input type="hidden" name="next" value={next} />

      <Field
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email ?? ""}
        error={state.fieldErrors?.email}
      />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />

      <SubmitButton className="w-full" pendingText="Entrando…">
        Iniciar sesión
      </SubmitButton>
    </form>
  );
}
