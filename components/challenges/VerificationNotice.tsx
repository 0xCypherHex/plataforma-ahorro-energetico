import { Info } from "lucide-react";

/** Aviso obligatorio: la verificación de los retos es aproximada y manual. */
export function VerificationNotice() {
  return (
    <div role="note" className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
      <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">La verificación de los retos es aproximada</p>
        <p className="mt-1">
          Al unirte guardamos tu consumo <strong>estimado</strong> semanal de los aparatos que mide el reto (su categoría,
          o todo tu hogar si no tiene una). Al completarlo lo comparamos con el consumo estimado de esos mismos aparatos en
          ese momento; así, si participas en varios retos a la vez, el mismo ahorro no se cuenta dos veces. Para que el resultado refleje tus cambios, actualiza las horas,
          los días o la potencia en <strong>Mis aparatos</strong> antes de completarlo. Todavía no se usan lecturas reales de
          medidores ni de enchufes inteligentes; esa integración está prevista para una versión futura.
        </p>
      </div>
    </div>
  );
}
