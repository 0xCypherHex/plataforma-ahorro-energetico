import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";

const styles = {
  error: { box: "border-red-200 bg-red-50 text-red-800", Icon: CircleAlert },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: CircleCheck },
  info: { box: "border-sky-200 bg-sky-50 text-sky-800", Icon: Info },
} as const;

export function Alert({ variant = "info", children }: { variant?: keyof typeof styles; children: ReactNode }) {
  const { box, Icon } = styles[variant];
  return (
    <div role={variant === "error" ? "alert" : "status"} className={`flex gap-2.5 rounded-xl border px-4 py-3 text-sm ${box}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
