import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { getCategory } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Admin · Editar categoría" };

export default async function EditCategoryPage(props: PageProps<"/admin/categorias/[slug]/editar">) {
  const { slug } = await props.params;
  const category = await getCategory(decodeURIComponent(slug));
  if (!category) notFound();
  return (
    <>
      <PageHeader title="Editar categoría" description={category.name} />
      <Card className="max-w-2xl">
        <CategoryForm category={category} nextOrder={category.sort_order} />
      </Card>
    </>
  );
}
