import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { esErrorDeRed } from './lib/offline';

export type Comercio = { id: string; nombre: string; cuit: string | null; provincia: string | null; categoria_actual: string | null; tipo_actividad: string | null;
  superficie_m2: number | null; energia_kw_anual: number | null; alquiler_anual: number | null; estado_suscripcion: string | null; prueba_hasta: string | null; fecha_proximo_cobro: string | null };
export type Rol = 'dueno' | 'empleado';
type Ctx = { session: Session | null; comercio: Comercio | null; rol: Rol; cargando: boolean; recargar: () => Promise<void> };
const C = createContext<Ctx>({ session: null, comercio: null, rol: 'dueno', cargando: true, recargar: async () => {} });
export const useAuth = () => useContext(C);

const K = 'vq_sesion_cache';
const leerCache = (uid: string): { comercio: Comercio; rol: Rol } | null => { try { const c = JSON.parse(localStorage.getItem(K) ?? 'null'); return c?.uid === uid ? c : null; } catch { return null; } };
const guardarCache = (uid: string, email: string | undefined, comercio: Comercio, rol: Rol) => { try { localStorage.setItem(K, JSON.stringify({ uid, email, comercio, rol })); } catch { /* sin espacio */ } };
// Sin internet y con la sesión vencida no se puede renovar: se usa la última sesión conocida solo para poder vender
const sesionOffline = (): Session | null => { try { const c = JSON.parse(localStorage.getItem(K) ?? 'null'); return c?.uid ? ({ user: { id: c.uid, email: c.email }, access_token: '' } as unknown as Session) : null; } catch { return null; } };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [rol, setRol] = useState<Rol>('dueno');
  const [cargando, setCargando] = useState(true);

  const cargarComercio = async (s: Session | null) => {
    if (!s) { setComercio(null); return; }
    const pedir = () => supabase.from('comercios')
      .select('id,nombre,cuit,provincia,categoria_actual,tipo_actividad,superficie_m2,energia_kw_anual,alquiler_anual,estado_suscripcion,prueba_hasta,fecha_proximo_cobro').maybeSingle();
    let { data, error } = await pedir();
    // Sin internet: se usa la última copia guardada para poder seguir vendiendo
    if (error && (esErrorDeRed(error.message) || !navigator.onLine)) {
      const c = leerCache(s.user.id);
      if (c) { setComercio(c.comercio); setRol(c.rol); return; }
    }
    // Sin comercio: si el dueño lo invitó como empleado, se vincula ahora
    if (!data && !error) {
      const { data: id } = await supabase.rpc('aceptar_invitacion');
      if (id) ({ data, error } = await pedir());
    }
    const c = (data as Comercio | null) ?? null;
    setComercio(c);
    if (c) {
      const { data: u } = await supabase.from('usuarios').select('rol').eq('id', s.user.id).maybeSingle();
      const r: Rol = u?.rol === 'empleado' ? 'empleado' : 'dueno';
      setRol(r); guardarCache(s.user.id, s.user.email, c, r);
    }
  };
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session ?? (!navigator.onLine ? sesionOffline() : null);
      setSession(s); await cargarComercio(s); setCargando(false);
    });
    // Al volver Internet se renueva la sesión real
    const volvio = () => supabase.auth.getSession().then(({ data }) => { if (data.session) { setSession(data.session); setTimeout(() => cargarComercio(data.session), 0); } });
    window.addEventListener('online', volvio);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setTimeout(() => cargarComercio(s), 0); });
    return () => { sub.subscription.unsubscribe(); window.removeEventListener('online', volvio); };
  }, []);
  return <C.Provider value={{ session, comercio, rol, cargando, recargar: () => cargarComercio(session) }}>{children}</C.Provider>;
}
