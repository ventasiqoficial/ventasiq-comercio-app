import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { supabase } from '../lib/supabase';
import { estadoPlan, leerPrecio, type Precio } from '../lib/plan';
import { ars } from '../lib/semaforo';

export default function MiPlan() {
  const { comercio, recargar } = useAuth();
  const [precio, setPrecio] = useState<Precio | null | undefined>(undefined);
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const p = estadoPlan(comercio!.estado_suscripcion, comercio!.prueba_hasta);

  useEffect(() => { leerPrecio().then(setPrecio); }, []);
  useEffect(() => { if (new URLSearchParams(window.location.search).get('mp')) recargar(); }, []);

  async function suscribirme() {
    setMsg(''); setOcupado(true);
    const { data, error } = await supabase.functions.invoke('crear-suscripcion');
    setOcupado(false);
    if (error || !data?.init_point) { setMsg('No pudimos iniciar la suscripción. Probá de nuevo en unos minutos.'); return; }
    window.location.href = data.init_point;
  }

  return (
    <>
      <h1>Mi plan</h1>
      <div className="card">
        <h2>Sistema VentasIQ para comercios</h2>
        <p style={{ fontSize: '1.6rem', margin: '4px 0' }}>
          {precio === undefined ? '…' : precio ? <>{ars(precio.monto)} <span className="mut" style={{ fontSize: '1rem' }}>por mes</span></> : <span className="mut" style={{ fontSize: '1rem' }}>Precio no disponible por ahora</span>}
        </p>
        {p.estado === 'activa' && <p className="msg">Tu suscripción está activa. Se cobra todos los meses con Mercado Pago{comercio!.fecha_proximo_cobro ? <> — próximo cobro: {new Date(comercio!.fecha_proximo_cobro).toLocaleDateString('es-AR')}</> : null}.</p>}
        {p.estado === 'en_prueba' && <p className="msg">Estás en prueba gratuita: te quedan {p.diasRestantes} {p.diasRestantes === 1 ? 'día' : 'días'}. Si te suscribís ahora, el primer cobro se hace recién cuando termina la prueba.</p>}
        {p.estado === 'prueba_vencida' && <p className="err">Tu prueba gratuita terminó. Suscribite para seguir usando el sistema; tus datos quedan guardados.</p>}
        {p.estado === 'cancelada' && <p className="err">Tu suscripción está cancelada. Podés volver a suscribirte cuando quieras; tus datos quedan guardados.</p>}
        {p.estado !== 'activa' && <button onClick={suscribirme} disabled={ocupado || !precio}>{ocupado ? 'Abriendo Mercado Pago…' : 'Suscribirme con Mercado Pago'}</button>}
        {msg && <p className="err">{msg}</p>}
      </div>
      <div className="card"><p className="mut">El cobro es mensual y automático con Mercado Pago. Podés cancelar cuando quieras desde tu cuenta de Mercado Pago, sin permanencia.</p></div>
    </>
  );
}
