import type { Metadata } from "next";
import { ApplianceForm } from "@/components/appliances/ApplianceForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireProfile } from "@/lib/auth";
import { getActiveCatalog, getCategories, getCo2Factor } from "@/lib/data/appliances";

export const metadata: Metadata = { title: "Agregar aparato" };

export default async function NewAppliancePage() {
  const profile = await requireProfile();
  const [categories, catalog, co2Factor] = await Promise.all([getCategories(), getActiveCatalog(), getCo2Factor()]);

  return (
    <>
      <PageHeader title="Agregar aparato" description="Elígelo del catálogo o escribe los datos de su etiqueta." />
      <ApplianceForm categories={categories} catalog={catalog} tariff={profile.tariff_per_kwh} co2Factor={co2Factor} />
    </>
  );
}
