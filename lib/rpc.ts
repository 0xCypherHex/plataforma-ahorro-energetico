/**
 * lib/rpc.ts — Llamadas tipadas a las funciones RPC de Supabase (COMPARTIDO Web + Móvil).
 * Solo depende de @supabase/supabase-js (que ambos proyectos tienen) y de types/database.
 *
 *   const { data, error } = await callRpc(supabase, "get_my_gamification");
 *   const { data } = await callRpc(supabase, "join_challenge", { p_challenge_id: id });
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RpcArgs, RpcName, RpcReturns } from "../types/database";

type ArgsTuple<N extends RpcName> = RpcArgs<N> extends Record<string, never> ? [] : [args: RpcArgs<N>];

export async function callRpc<N extends RpcName>(client: SupabaseClient, name: N, ...args: ArgsTuple<N>) {
  const { data, error } = await client.rpc(name, (args[0] ?? {}) as Record<string, unknown>);
  return { data: (data ?? null) as RpcReturns<N> | null, error };
}
