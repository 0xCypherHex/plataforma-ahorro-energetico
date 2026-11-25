import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogItemForm } from "@/components/admin/CatalogItemForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { getAllCategories, getCatalogItem } from "@/lib/data/admin";
import { isUuid } from "@/lib/forms";

export const metadata: Metadata = { title: "Admin · Editar aparato de catálogo" };

export default async function EditCatalogItemPage(props: PageProps<"/admin/catalogo/[id]/editar">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const [item, categories] = await Promise.all([getCatalogItem(id), getAllCategories()]);
  if (!item) notFound();
  return (
    <>
      <PageHeader title="Editar aparato del catálogo" description={item.name} />
      <Card className="max-w-3xl">
        <CatalogItemForm item={item} categories={categories} />
      </Card>
    </>
  );
}
