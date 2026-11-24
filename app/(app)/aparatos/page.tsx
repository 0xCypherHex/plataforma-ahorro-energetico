import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Plug } from "lucide-react";
import { ConsumptionOverview } from "@/components/appliances/ConsumptionOverview";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { primaryButtonClassName } from "@/components/ui/styles";
import { requireProfile } from "@/lib/auth";
import { getCategories, getCo2Factor, getMyAppliances, getMyChallengeSavings } from "@/lib/data/appliances";

export const metadata: Metadata = { title: "Mis aparatos" };

const OK_MESSAGES: Record<string, string> = {
  creado: "Aparato agregado. Tus cálculos ya están actualizados.",
  actualizado: "Cambios guardados.",
  eliminado: "Aparato eliminado.",
};

export default async function AppliancesPage(props: PageProps<"/aparatos">) {
  const searchParams = await props.searchParams;
  const profile = await requireProfile();

  const [appliances, categories, co2Factor, savings] = await Promise.all([
    getMyAppliances(profile.id),
    getCategories(),
    getCo2Factor(),
    getMyChallengeSavings(profile.id),
  ]);

  const ok = typeof searchParams.ok === "string" ? OK_MESSAGES[searchParams.ok] : undefined;

  return (
    <>
      <PageHeader
        title="Mis aparatos"
        description="Calcula cuánta energía consumen tus aparatos y cuánto te cuestan."
        actions={
          <Link href="/aparatos/nuevo" className={primaryButtonClassName}>
            <Plus className="size-5" aria-hidden /> Agregar aparato
          </Link>
        }
      />

      {ok && (
        <div className="mb-4">
          <Alert variant="success">{ok}</Alert>
        </div>
      )}

      {appliances.length === 0 ? (
        <Card className="py-12 text-center">
          <Plug className="mx-auto size-12 text-emerald-600" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">Aún no registras aparatos</h2>
          <p className="mx-auto mt-1 max-w-md text-slate-600">
            Empieza con los que más usas: refrigerador, focos, televisión o ventilador. Puedes elegirlos del catálogo.
          </p>
          <Link href="/aparatos/nuevo" className={`${primaryButtonClassName} mt-6`}>
            <Plus className="size-5" aria-hidden /> Agregar mi primer aparato
          </Link>
        </Card>
      ) : (
        <ConsumptionOverview
          appliances={appliances}
          categories={categories}
          tariff={profile.tariff_per_kwh}
          co2Factor={co2Factor}
          savings={savings}
        />
      )}
    </>
  );
}
