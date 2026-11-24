"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * true solo en el navegador (false durante el render del servidor y el prerender).
 * Recharts usa valores aleatorios al dibujar; renderizarlo únicamente en el cliente evita
 * errores de prerender de Next 16 y diferencias de hidratación.
 */
export function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
