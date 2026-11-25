"use client";

import { useActionState } from "react";
import { grantCommunityAwards } from "@/app/admin/actions";
import { Alert } from "@/components/ui/Alert";
import { SelectField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatDate } from "@/lib/dates";
import { initialFormState } from "@/lib/forms";

/** Entrega oro, plata y bronce a las 3 comunidades con mayor ahorro promedio de una semana. */
export function GrantAwardsForm({ weeks, defaultWeek }: { weeks: string[]; defaultWeek: string }) {
  const [state, formAction] = useActionState(grantCommunityAwards, initialFormState);
  return (
    <form action={formAction} className="space-y-3">
      {state.message && <Alert variant={state.status === "success" ? "success" : "error"}>{state.message}</Alert>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <SelectField label="Semana a premiar" name="week_start" defaultValue={defaultWeek}>
            {weeks.map((w) => (
              <option key={w} value={w}>
                Semana del {formatDate(w, { day: "numeric", month: "long", year: "numeric" })}
              </option>
            ))}
          </SelectField>
        </div>
        <SubmitButton pendingText="Calculando…">Entregar reconocimientos</SubmitButton>
      </div>
    </form>
  );
}
