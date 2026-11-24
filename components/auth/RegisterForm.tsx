"use client";

import { useActionState } from "react";
import { signup } from "@/app/(auth)/actions";
import { AccountTypePicker } from "@/components/auth/AccountTypePicker";
import { CommunityPicker } from "@/components/auth/CommunityPicker";
import { Alert } from "@/components/ui/Alert";
import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { CommunitySummary } from "@/lib/auth";
import { initialFormState } from "@/lib/forms";

export function RegisterForm({ communities }: { communities: CommunitySummary[] }) {
  const [state, formAction] = useActionState(signup, initialFormState);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};

  if (state.status === "success") {
    return <Alert variant="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.message && <Alert variant="error">{state.message}</Alert>}

      <Field
        label="Nombre completo"
        name="full_name"
        autoComplete="name"
        maxLength={120}
        required
        defaultValue={v.full_name ?? ""}
        error={e.full_name}
      />
      <Field
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={v.email ?? ""}
        error={e.email}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          error={e.password}
          hint="Mínimo 8, con letras y números."
        />
        <Field
          label="Confirmar contraseña"
          name="password_confirm"
          type="password"
          autoComplete="new-password"
          required
          error={e.password_confirm}
        />
      </div>

      <AccountTypePicker defaultValue={v.account_type || "hogar"} error={e.account_type} />

      <CommunityPicker
        communities={communities}
        defaultChoice={v.community_choice ?? ""}
        defaultNewName={v.new_community_name ?? ""}
        defaultNewMunicipality={v.new_community_municipality ?? ""}
        errors={e}
      />

      <SubmitButton className="w-full" pendingText="Creando cuenta…">
        Crear cuenta
      </SubmitButton>
    </form>
  );
}
