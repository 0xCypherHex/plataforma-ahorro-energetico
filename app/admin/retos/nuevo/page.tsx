import type { Metadata } from "next";
import { ChallengeForm } from "@/components/admin/ChallengeForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { getAllCategories } from "@/lib/data/admin";
import { mondaysAround, todayIn, weekStartOf } from "@/lib/dates";

export const metadata: Metadata = { title: "Admin · Nuevo reto" };

export default async function NewChallengePage() {
  const categories = await getAllCategories();
  const today = todayIn();
  return (
    <>
      <PageHeader title="Nuevo reto" description="Se publica en la semana elegida (de lunes a domingo)." />
      <Card className="max-w-3xl">
        <ChallengeForm categories={categories} mondays={mondaysAround(today, 0, 8)} currentWeek={weekStartOf(today)} />
      </Card>
    </>
  );
}
