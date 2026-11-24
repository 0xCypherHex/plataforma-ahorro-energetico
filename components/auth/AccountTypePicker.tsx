import { Home, Store } from "lucide-react";

const OPTIONS = [
  { value: "hogar", label: "Hogar", description: "Familias, vecinos o estudiantes", Icon: Home },
  { value: "negocio", label: "Pequeño negocio", description: "Tiendas, talleres, locales", Icon: Store },
] as const;

/** Tarjetas de selección para el tipo de perfil (radio buttons accesibles). */
export function AccountTypePicker({ defaultValue = "hogar", error }: { defaultValue?: string; error?: string }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1.5 block text-sm font-medium text-slate-700">Tipo de perfil</legend>
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map(({ value, label, description, Icon }) => (
          <label
            key={value}
            className="group relative flex cursor-pointer flex-col gap-1 rounded-xl border border-slate-300 bg-white p-3.5 transition
                       hover:border-emerald-400 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50
                       has-[:checked]:ring-2 has-[:checked]:ring-emerald-500/30 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-500"
          >
            <input
              type="radio"
              name="account_type"
              value={value}
              defaultChecked={defaultValue === value}
              className="sr-only"
            />
            <Icon className="size-5 text-emerald-700" aria-hidden />
            <span className="font-semibold text-slate-900">{label}</span>
            <span className="text-xs text-slate-500">{description}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </fieldset>
  );
}
