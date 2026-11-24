"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/(app)/perfil/actions";
import { AccountTypePicker } from "@/components/auth/AccountTypePicker";
import { CommunityPicker } from "@/components/auth/CommunityPicker";
import { Alert } from "@/components/ui/Alert";
import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { CommunitySummary, CurrentProfile } from "@/lib/auth";
import { initialFormState } from "@/lib/forms";

export function ProfileForm({ profile, communities }: { profile: CurrentProfile; communities: CommunitySummary[] }) {
  const [state, formAction] = useActionState(updateProfile, initialFormState);
  const v = state.status === "error" ? (state.values ?? {}) : {};
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.message && <Alert variant={state.status === "success" ? "success" : "error"}>{state.message}</Alert>}

      <Field
        label="Nombre completo"
        name="full_name"
        autoComplete="name"
        maxLength={120}
        defaultValue={v.full_name ?? profile.full_name}
        error={e.full_name}
      />

      <Field label="Correo electrónico" name="email_readonly" type="email" value={profile.email} disabled readOnly />

      <AccountTypePicker defaultValue={v.account_type ?? profile.account_type} error={e.account_type} />

      <CommunityPicker
        key={profile.community_id ?? "sin-comunidad"}
        communities={communities}
        defaultChoice={v.community_choice ?? profile.community_id ?? ""}
        defaultNewName={v.new_community_name ?? ""}
        defaultNewMunicipality={v.new_community_municipality ?? ""}
        errors={e}
      />

      <Field
        label="Tarifa eléctrica (MXN por kWh)"
        name="tariff_per_kwh"
        type="number"
        inputMode="decimal"
        step="0.0001"
        min="0.0001"
        max="100"
        defaultValue={v.tariff_per_kwh ?? String(profile.tariff_per_kwh)}
        error={e.tariff_per_kwh}
        hint="Divide el total de tu recibo entre los kWh consumidos para obtener tu costo promedio."
      />

      <SubmitButton pendingText="Guardando…">Guardar cambios</SubmitButton>
    </form>
  );
}
