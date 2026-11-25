import type { Metadata } from "next";
import { CatalogItemForm } from "@/components/admin/CatalogItemForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { getAllCategories } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Admin · Nuevo aparato de catálogo" };

export default async function NewCatalogItemPage() {
  const categories = await getAllCategories();
  return (
    <>
      <PageHeader title="Agregar al catálogo" />
      <Card className="max-w-3xl">
        <CatalogItemForm categories={categories} />
      </Card>
    </>
  );
}
