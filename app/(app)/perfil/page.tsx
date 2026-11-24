import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { Card, CardTitle } from "@/components/ui/Card";
import { type CommunitySummary, requireProfile } from "@/lib/auth";
import { ROLE_LABELS, formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("communities").select("id, name, municipality").order("name");
  const communities: CommunitySummary[] = data ?? [];

  return (
    <>
      <PageHeader title="Mi perfil" description="Tu comunidad y tu tarifa se usan en todos los cálculos de consumo y costo." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <ProfileForm profile={profile} communities={communities} />
        </Card>

        <Card className="h-fit">
          <CardTitle>Mi cuenta</CardTitle>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Rol</dt>
              <dd className="font-medium text-slate-900">{ROLE_LABELS[profile.role]}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Puntos</dt>
              <dd className="font-medium text-slate-900">{formatNumber(profile.points, 0)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Nivel</dt>
              <dd className="font-medium text-slate-900">{profile.level}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Miembro desde</dt>
              <dd className="font-medium text-slate-900">
                {new Date(profile.created_at).toLocaleDateString("es-MX", { dateStyle: "medium" })}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Los puntos, el nivel y el rol los calcula la plataforma y no se pueden editar manualmente.
          </p>
        </Card>
      </div>
    </>
  );
}
