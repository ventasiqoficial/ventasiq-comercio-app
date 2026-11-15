// Modo sin internet: guarda copias de productos y clientes, y una cola de ventas que se envían al volver la conexión.
// Cada venta lleva su propio id (p_id): si se reenvía, la base no la duplica.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type VentaPayload = {
  p_id: string; p_medio: string; p_items: { producto_id: string | null; cantidad: number; precio_unitario: number; descripcion?: string }[];
  p_total: number | null; p_fecha: string; p_pagos: { medio: string; importe: number }[] | null; p_cliente_id: string | null;
};
type Pendiente = { payload: VentaPayload; error?: string };

const K_COLA = 'vq_cola_ventas';
const cacheKey = (nombre: string, comercioId: string) => `vq_cache_${nombre}_${comercioId}`;

function leer<T>(k: string, def: T): T { try { const s = localStorage.getItem(k); return s ? (JSON.parse(s) as T) : def; } catch { return def; } }
function guardar(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio o bloqueado */ } }

export const guardarCache = (nombre: string, comercioId: string, v: unknown) => guardar(cacheKey(nombre, comercioId), v);
export const leerCache = <T,>(nombre: string, comercioId: string, def: T) => leer<T>(cacheKey(nombre, comercioId), def);

export const esErrorDeRed = (msg: string | undefined) => !!msg && /failed to fetch|network|load failed|fetch/i.test(msg);
export const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

export const pendientes = (): Pendiente[] => leer<Pendiente[]>(K_COLA, []);
export function encolarVenta(payload: VentaPayload) { guardar(K_COLA, [...pendientes(), { payload }]); avisar(); }

const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach(f => f());

let enCurso = false;
/** Envía las ventas guardadas. Se detiene ante un error de red; las que la base rechaza quedan marcadas con su motivo. */
export async function sincronizar(): Promise<{ enviadas: number; quedan: number }> {
  if (enCurso) return { enviadas: 0, quedan: pendientes().length };
  enCurso = true; let enviadas = 0;
  try {
    const cola = pendientes(); const resto: Pendiente[] = [];
    let cortado = false;
    for (const p of cola) {
      if (cortado || p.error) { resto.push(p); continue; }
      const { error } = await supabase.rpc('registrar_venta', p.payload);
      if (!error) { enviadas++; continue; }
      if (esErrorDeRed(error.message)) { cortado = true; resto.push(p); continue; }
      resto.push({ ...p, error: error.message });
    }
    guardar(K_COLA, resto);
    return { enviadas, quedan: resto.length };
  } finally { enCurso = false; avisar(); }
}
export function descartarFallidas() { guardar(K_COLA, pendientes().filter(p => !p.error)); avisar(); }

/** Estado de conexión y ventas pendientes, para el aviso de arriba. Sincroniza solo al volver Internet. */
export function useConexion() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [cola, setCola] = useState(() => pendientes());
  useEffect(() => {
    const act = () => setCola(pendientes());
    oyentes.add(act);
    const subir = () => { setOnline(true); sincronizar(); };
    const bajar = () => setOnline(false);
    window.addEventListener('online', subir); window.addEventListener('offline', bajar);
    if (navigator.onLine && pendientes().length) sincronizar();
    return () => { oyentes.delete(act); window.removeEventListener('online', subir); window.removeEventListener('offline', bajar); };
  }, []);
  return { online, pendientes: cola.filter(p => !p.error).length, fallidas: cola.filter(p => p.error) };
}
