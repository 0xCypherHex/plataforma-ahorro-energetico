import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChallengeForm } from "@/components/admin/ChallengeForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { getAllCategories, getChallenge } from "@/lib/data/admin";
import { mondaysAround, todayIn, weekStartOf } from "@/lib/dates";
import { isUuid } from "@/lib/forms";

export const metadata: Metadata = { title: "Admin · Editar reto" };

export default async function EditChallengePage(props: PageProps<"/admin/retos/[id]/editar">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const [challenge, categories] = await Promise.all([getChallenge(id), getAllCategories()]);
  if (!challenge) notFound();
  const today = todayIn();

  return (
    <>
      <PageHeader title="Editar reto" description={challenge.title} />
      <div className="mb-4 max-w-3xl">
        <Alert variant="info">
          Quienes ya se unieron conservan la categoría medida y su consumo inicial. La meta y los puntos nuevos sí se aplican
          a todos al completar el reto.
        </Alert>
      </div>
      <Card className="max-w-3xl">
        <ChallengeForm challenge={challenge} categories={categories} mondays={mondaysAround(today, 1, 8)} currentWeek={weekStartOf(today)} />
      </Card>
    </>
  );
}
