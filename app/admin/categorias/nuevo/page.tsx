import type { Metadata } from "next";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { getAllCategories } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Admin · Nueva categoría" };

export default async function NewCategoryPage() {
  const categories = await getAllCategories();
  const nextOrder = (categories.reduce((max, c) => Math.max(max, c.sort_order), 0) || 0) + 10;
  return (
    <>
      <PageHeader title="Nueva categoría" />
      <Card className="max-w-2xl">
        <CategoryForm nextOrder={nextOrder} />
      </Card>
    </>
  );
}
