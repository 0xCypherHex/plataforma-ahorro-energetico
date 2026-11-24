import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplianceForm } from "@/components/appliances/ApplianceForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireProfile } from "@/lib/auth";
import { getActiveCatalog, getCategories, getCo2Factor, getMyAppliance } from "@/lib/data/appliances";
import { isUuid } from "@/lib/forms";

export const metadata: Metadata = { title: "Editar aparato" };

export default async function EditAppliancePage(props: PageProps<"/aparatos/[id]/editar">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();

  const profile = await requireProfile();
  const appliance = await getMyAppliance(profile.id, id);
  if (!appliance) notFound();

  const [categories, catalog, co2Factor] = await Promise.all([
    getCategories(appliance.category_slug),
    getActiveCatalog(),
    getCo2Factor(),
  ]);

  return (
    <>
      <PageHeader title="Editar aparato" description={appliance.name} />
      <ApplianceForm
        appliance={appliance}
        categories={categories}
        catalog={catalog}
        tariff={profile.tariff_per_kwh}
        co2Factor={co2Factor}
      />
    </>
  );
}
