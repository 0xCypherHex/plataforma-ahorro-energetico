"use client";

import { useState } from "react";
import { Field, SelectField } from "@/components/ui/Field";
import type { CommunitySummary } from "@/lib/auth";
import { NEW_COMMUNITY_VALUE } from "@/lib/forms";

interface Props {
  communities: CommunitySummary[];
  defaultChoice?: string;
  defaultNewName?: string;
  defaultNewMunicipality?: string;
  errors?: Record<string, string>;
}

/** Selector de comunidad con opción para registrar una nueva colonia. */
export function CommunityPicker({
  communities,
  defaultChoice = "",
  defaultNewName = "",
  defaultNewMunicipality = "",
  errors,
}: Props) {
  const [choice, setChoice] = useState(defaultChoice);

  return (
    <div className="space-y-4">
      <SelectField
        label="Comunidad o colonia (opcional)"
        name="community_choice"
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        error={errors?.community_choice}
        hint="Te permite comparar tu ahorro con tus vecinos."
      >
        <option value="">Sin comunidad por ahora</option>
        {communities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.municipality ? ` · ${c.municipality}` : ""}
          </option>
        ))}
        <option value={NEW_COMMUNITY_VALUE}>➕ Mi colonia no aparece, quiero registrarla</option>
      </SelectField>

      {choice === NEW_COMMUNITY_VALUE && (
        <div className="grid gap-4 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-4 sm:grid-cols-2">
          <Field
            label="Nombre de la colonia"
            name="new_community_name"
            maxLength={120}
            placeholder="Ej. Col. Las Américas"
            defaultValue={defaultNewName}
            error={errors?.new_community_name}
          />
          <Field
            label="Municipio o alcaldía"
            name="new_community_municipality"
            maxLength={120}
            placeholder="Ej. Ecatepec"
            defaultValue={defaultNewMunicipality}
            error={errors?.new_community_municipality}
          />
        </div>
      )}
    </div>
  );
}
