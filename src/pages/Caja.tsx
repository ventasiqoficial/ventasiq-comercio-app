import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ars } from '../lib/semaforo';
import { ETIQUETAS } from './Vender';
import { useAuth } from '../auth';

type Venta = { id: string; total: number; medio: string; creado_en: string };
type Resumen = { turno_id: string; abierta_en: string; cerrada_en: string | null; efectivo_inicial: number; cantidad_ventas: number; ventas_total: number;
  por_medio: Record<string, number>; ventas_efectivo: number; fiado_otorgado: number; cobros_deuda_efectivo: number; ingresos: number; retiros: number;
  efectivo_esperado: number; efectivo_contado: number | null; diferencia: number | null };
type Turno = { id: string; abierta_en: string; cerrada_en: string | null; efectivo_esperado: number | null; efectivo_contado: number | null; diferencia: number | null };
const hoy = () => new Date().toLocaleDateString('en-CA');
const hora = (s: string) => new Date(s).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function Caja() {
  const { rol } = useAuth();
  const [dia, setDia] = useState(hoy());
  const [lista, setLista] = useState<Venta[]>([]);
  const [turno, setTurno] = useState<Resumen | null>(null);
  const [historial, setHistorial] = useState<Turno[]>([]);
  const [inicial, setInicial] = useState('');
  const [contado, setContado] = useState('');
  const [mov, setMov] = useState({ tipo: 'retiro', importe: '', concepto: '' });
  const [cierre, setCierre] = useState<Resumen | null>(null);
  const [err, setErr] = useState('');

  const cargar = async () => {
    const { data } = await supabase.from('ventas').select('id,total,medio,creado_en').eq('fecha', dia).order('creado_en', { ascending: false });
    setLista((data ?? []) as Venta[]);
    const { data: ab } = await supabase.from('turnos_caja').select('id').is('cerrada_en', null).maybeSingle();
    if (ab) { const { data: r } = await supabase.rpc('resumen_turno', { p_turno: ab.id }); setTurno(r as Resumen); } else setTurno(null);
    const { data: h } = await supabase.from('turnos_caja').select('id,abierta_en,cerrada_en,efectivo_esperado,efectivo_contado,diferencia').not('cerrada_en', 'is', null).order('abierta_en', { ascending: false }).limit(8);
    setHistorial((h ?? []) as Turno[]);
  };
  useEffect(() => { cargar(); }, [dia]);

  const llamar = async (fn: string, args: Record<string, unknown>) => {
    setErr(''); const { data, error } = await supabase.rpc(fn, args);
    if (error) { setErr(error.message); return null; }
    return data;
  };
  async function abrir() { if (await llamar('abrir_caja', { p_inicial: Number(inicial || 0) }) !== null) { setInicial(''); setCierre(null); cargar(); } }
  async function movimiento() {
    if (!(Number(mov.importe) > 0)) return;
    if (await llamar('movimiento_caja', { p_tipo: mov.tipo, p_importe: Number(mov.importe), p_concepto: mov.concepto || null }) !== null) { setMov({ ...mov, importe: '', concepto: '' }); cargar(); }
  }
  async function cerrar() {
    if (contado === '') { setErr('Contá el efectivo del cajón e ingresalo.'); return; }
    const r = await llamar('cerrar_caja', { p_contado: Number(contado) });
    if (r) { setCierre(r as Resumen); setContado(''); cargar(); }
  }
  async function anular(id: string) {
    if (!confirm('¿Anular esta venta? Se repone el stock.')) return;
    const { error } = await supabase.rpc('anular_venta', { p_id: id }); if (error) setErr(error.message); else cargar();
  }

  const total = lista.reduce((s, v) => s + Number(v.total), 0);
  const porMedio = Object.entries(ETIQUETAS).map(([k, t]) => [t, lista.filter(v => v.medio === k).reduce((s, v) => s + Number(v.total), 0)] as const).filter(x => x[1] > 0);
  const elec = lista.filter(v => !['efectivo', 'cuenta_corriente'].includes(v.medio)).reduce((s, v) => s + Number(v.total), 0);
  const Dif = ({ d }: { d: number }) => <b className={d === 0 ? 'msg' : 'err'}>{d === 0 ? 'Cuadra justo' : d > 0 ? `Sobran ${ars(d)}` : `Faltan ${ars(-d)}`}</b>;

  return (
    <>
      <h1>Caja</h1>
      {err && <p className="err">{err}</p>}

      {!turno && <div className="card">
        <h2>Caja cerrada</h2>
        <p className="mut">Abrí la caja al empezar el turno, con el efectivo que hay en el cajón. Al cerrar, el sistema te dice si el efectivo cuadra.</p>
        <label>Efectivo en el cajón al empezar</label>
        <input type="number" min="0" step="0.01" inputMode="decimal" value={inicial} onChange={e => setInicial(e.target.value)} placeholder="$ 0" />
        <button onClick={abrir}>Abrir caja</button>
      </div>}

      {turno && <div className="card">
        <h2>Caja abierta desde {hora(turno.abierta_en)}</h2>
        <table><tbody>
          <tr><td>Efectivo al empezar</td><td className="n">{ars(turno.efectivo_inicial)}</td></tr>
          <tr><td>Ventas en efectivo</td><td className="n">{ars(turno.ventas_efectivo)}</td></tr>
          {turno.cobros_deuda_efectivo > 0 && <tr><td>Deudas cobradas en efectivo</td><td className="n">{ars(turno.cobros_deuda_efectivo)}</td></tr>}
          {turno.ingresos > 0 && <tr><td>Otros ingresos</td><td className="n">{ars(turno.ingresos)}</td></tr>}
          {turno.retiros > 0 && <tr><td>Retiros</td><td className="n">−{ars(turno.retiros)}</td></tr>}
          <tr><td><b>Efectivo que debería haber</b></td><td className="n"><b>{ars(turno.efectivo_esperado)}</b></td></tr>
        </tbody></table>
        <p className="mut">{turno.cantidad_ventas} ventas por {ars(turno.ventas_total)} en este turno.</p>

        <h2>Retiro o ingreso de efectivo</h2>
        <div className="row">
          <div><label>Tipo</label><select value={mov.tipo} onChange={e => setMov({ ...mov, tipo: e.target.value })}><option value="retiro">Retiro (pago a proveedor, gasto…)</option><option value="ingreso">Ingreso (cambio, aporte…)</option></select></div>
          <div><label>Importe</label><input type="number" min="0" step="0.01" inputMode="decimal" value={mov.importe} onChange={e => setMov({ ...mov, importe: e.target.value })} /></div>
          <div><label>Motivo</label><input value={mov.concepto} onChange={e => setMov({ ...mov, concepto: e.target.value })} /></div>
        </div>
        <button className="sec" onClick={movimiento}>Anotar</button>

        <h2>Cerrar caja</h2>
        <label>Efectivo contado en el cajón</label>
        <input type="number" min="0" step="0.01" inputMode="decimal" value={contado} onChange={e => setContado(e.target.value)} placeholder="$" />
        <button onClick={cerrar}>Cerrar caja</button>
      </div>}

      {cierre && <div className="card">
        <h2>Caja cerrada</h2>
        <p>Esperado {ars(cierre.efectivo_esperado)} · contado {ars(cierre.efectivo_contado ?? 0)} → <Dif d={Number(cierre.diferencia ?? 0)} /></p>
        <p className="mut">Vendiste {ars(cierre.ventas_total)} en {cierre.cantidad_ventas} ventas: {Object.entries(cierre.por_medio).map(([k, v]) => `${ETIQUETAS[k] ?? k} ${ars(Number(v))}`).join(' · ') || '—'}</p>
        {cierre.ventas_total > 0 && <p><Link to="/facturar">Ver qué facturar →</Link></p>}
      </div>}

      <div className="card">
        <label>Ventas del día</label><input type="date" value={dia} onChange={e => setDia(e.target.value)} />
        <h2>Vendido: {ars(total)}</h2>
        {porMedio.map(([t, v]) => <div key={t} className="mut">{t}: {ars(v)}</div>)}
        {rol === 'dueno' && total > 0 && <p>{elec > 0 && <>Cobrado con medios electrónicos: <b>{ars(elec)}</b>. </>}<Link to="/facturar">Ver qué facturar →</Link></p>}
      </div>
      <div className="card"><table><tbody>
        {lista.map(v => <tr key={v.id}><td>{new Date(v.creado_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td><td>{ETIQUETAS[v.medio] ?? v.medio}</td>
          <td className="n">{ars(Number(v.total))}</td><td><a href="#" onClick={e => { e.preventDefault(); anular(v.id); }}>anular</a></td></tr>)}
        {!lista.length && <tr><td className="mut">No hay ventas este día.</td></tr>}
      </tbody></table></div>

      {historial.length > 0 && <div className="card"><h2>Últimos cierres</h2><table><tbody>
        {historial.map(t => <tr key={t.id}><td>{hora(t.abierta_en)}</td><td className="n">{ars(Number(t.efectivo_contado ?? 0))}</td><td className="n"><Dif d={Number(t.diferencia ?? 0)} /></td></tr>)}
      </tbody></table></div>}
    </>
  );
}
