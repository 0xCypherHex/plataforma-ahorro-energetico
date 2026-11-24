import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeRedirectPath } from "@/lib/forms";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const nextParam = typeof searchParams.next === "string" ? searchParams.next : "";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-emerald-900/5 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Bienvenido de nuevo</h1>
      <p className="mt-1 text-slate-600">Entra para ver tu consumo y tus retos de la semana.</p>

      <div className="mt-6">
        <LoginForm next={safeRedirectPath(nextParam)} />
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-emerald-700 hover:underline">
          Regístrate gratis
        </Link>
      </p>
    </div>
  );
}
