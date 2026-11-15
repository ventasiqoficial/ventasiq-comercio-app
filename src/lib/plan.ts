// Precio y estado del plan. El precio sale del panel superadmin de VentasIQ (tabla `precios`).
export const PRECIOS_URL = (import.meta.env.VITE_PRECIOS_URL as string | undefined) ?? 'https://kxausclxqtwoblsaqcqv.supabase.co';
// Clave pública (publishable) del Supabase de VentasIQ: solo permite leer `precios` (SELECT público).
export const PRECIOS_KEY = (import.meta.env.VITE_PRECIOS_ANON_KEY as string | undefined) ?? 'sb_publishable_cxtz_qSApL-KkQ31NdLPRw_6SbdYce5';

export type Precio = { monto: number; moneda: string; nombre: string };

export async function leerPrecio(): Promise<Precio | null> {
  try {
    const r = await fetch(`${PRECIOS_URL}/rest/v1/precios?clave=eq.comercio_mensual&select=monto,moneda,nombre_plan`,
      { headers: { apikey: PRECIOS_KEY, Authorization: `Bearer ${PRECIOS_KEY}` } });
    if (!r.ok) return null;
    const f = (await r.json())?.[0];
    const monto = Number(f?.monto);
    return monto > 0 ? { monto, moneda: f.moneda ?? 'ARS', nombre: f.nombre_plan ?? 'Plan mensual' } : null;
  } catch { return null; }
}

export type EstadoPlan = { vigente: boolean; estado: 'activa' | 'en_prueba' | 'prueba_vencida' | 'cancelada'; diasRestantes: number };

export function estadoPlan(estado: string | null | undefined, pruebaHasta: string | null | undefined, ahora = new Date()): EstadoPlan {
  if (estado === 'activa') return { vigente: true, estado: 'activa', diasRestantes: 0 };
  if (estado === 'cancelada') return { vigente: false, estado: 'cancelada', diasRestantes: 0 };
  const ms = pruebaHasta ? new Date(pruebaHasta).getTime() - ahora.getTime() : 0;
  const dias = Math.max(0, Math.ceil(ms / 86400000));
  return dias > 0 ? { vigente: true, estado: 'en_prueba', diasRestantes: dias } : { vigente: false, estado: 'prueba_vencida', diasRestantes: 0 };
}
