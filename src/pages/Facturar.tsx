import { TIPOS_EMITIDOS } from '../lib/comprobantes';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { ars } from '../lib/semaforo';

type Dia = { fecha: string; total: number; electronico: number; efectivo: number; facturado: number; falta_electronico: number; falta_total: number };
const hoy = () => new Date().toLocaleDateString('en-CA');
const haceDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('en-CA'); };

export default function Facturar() {
  const { comercio } = useAuth();
  const [dias, setDias] = useState<Dia[]>([]);
  const [sel, setSel] = useState(hoy());
  const [f, setF] = useState({ tipo: '11', pv: '', numero: '', importe: '' });
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');

  const cargar = async () => {
    const { data, error } = await supabase.rpc('facturacion_pendiente', { p_desde: haceDias(30), p_hasta: hoy() });
    if (error) setErr(error.message); else setDias(((data ?? []) as Dia[]).map(d => ({ ...d, total: +d.total, electronico: +d.electronico, efectivo: +d.efectivo, facturado: +d.facturado, falta_electronico: +d.falta_electronico, falta_total: +d.falta_total })));
  };
  useEffect(() => { cargar(); }, []);

  const d = dias.find(x => x.fecha === sel);
  useEffect(() => { if (d) setF(p => ({ ...p, importe: d.falta_total > 0 ? String(d.falta_total) : '' })); }, [sel, dias.length]);
  const atrasados = dias.filter(x => x.fecha !== hoy() && x.falta_total > 0);
  const totalAtrasado = atrasados.reduce((s, x) => s + x.falta_total, 0);

  async function registrar(e: FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    const { error } = await supabase.from('comprobantes_emitidos').insert({ comercio_id: comercio!.id, fecha: sel, tipo_comprobante: f.tipo, punto_venta: Number(f.pv || 0),
      numero: Number(f.numero), importe: Number(f.importe), es_nota_credito: ['3', '8', '13', '53', '203', '208', '213'].includes(f.tipo), origen: 'manual' });
    if (error) { setErr(error.code === '23505' ? 'Ese comprobante ya está registrado.' : error.message); return; }
    setMsg('Factura registrada.'); setF({ ...f, numero: '' }); cargar();
  }

  return (
    <>
      <h1>Qué facturar</h1>
      <p className="mut">Tomamos las ventas que anotás en “Gestión del comercio” y te mostramos cuánto te falta facturar de cada día. Todas las ventas se facturan, también las de efectivo. Lo cobrado por medios electrónicos queda registrado en bancos y billeteras, y ARCA lo puede ver.</p>
      <div className="card">
        <label>Día</label>
        <input type="date" value={sel} max={hoy()} min={haceDias(30)} onChange={e => setSel(e.target.value)} />
        {d ? <>
          <div className="row" style={{ marginTop: 10 }}>
            <div><div className="mut">Vendido</div><b>{ars(d.total)}</b></div>
            <div><div className="mut">Con medios electrónicos</div><b>{ars(d.electronico)}</b></div>
            <div><div className="mut">En efectivo</div><b>{ars(d.efectivo)}</b></div>
            <div><div className="mut">Ya facturado</div><b>{ars(d.facturado)}</b></div>
          </div>
          {d.falta_total > 0
            ? <h2>Te falta facturar {ars(d.falta_total)}</h2>
            : <h2>{d.total > 0 ? '✔ Todo lo vendido este día ya está facturado' : 'No hay ventas anotadas este día'}</h2>}
          {d.falta_total > 0 && d.falta_electronico > 0 && <p className="mut">De ese monto, {ars(d.falta_electronico)} se cobró con medios electrónicos.</p>}
          <p className="mut">Podés hacer una factura por cada venta o una sola por todo el día. Vos decidís cómo; lo importante es que no quede nada sin facturar.</p>
        </> : <p className="mut">Cargando…</p>}
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Hacela en ARCA y registrala acá</h2>
        <ol>
          <li>Entrá al Facturador de ARCA y emití una <b>Factura C a Consumidor Final</b> por el monto sugerido.</li>
          <li>Volvé y anotá el número abajo, así el sistema la descuenta del pendiente.</li>
        </ol>
        <form onSubmit={registrar}>
          <div className="row">
            <div><label>Tipo de comprobante</label><select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}>{TIPOS_EMITIDOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
              <small className="mut">Para una venta normal elegí «Factura C». La nota de crédito es para anular una factura.</small></div>
            <div><label>Punto de venta</label><input type="number" min="0" value={f.pv} onChange={e => setF({ ...f, pv: e.target.value })} required />
              <small className="mut">Es el primer número de la factura en ARCA (en 00003-00000125 es el 3).</small></div>
            <div><label>Número de factura</label><input type="number" min="1" value={f.numero} onChange={e => setF({ ...f, numero: e.target.value })} required /></div>
            <div><label>Importe</label><input type="number" min="0" step="0.01" value={f.importe} onChange={e => setF({ ...f, importe: e.target.value })} required /></div>
          </div>
          {err && <p className="err">{err}</p>}{msg && <p className="msg">{msg}</p>}
          <button>Registrar factura emitida</button>
        </form>
        <p className="mut">Aviso: ARCA fija límites para facturar a consumidor final sin identificarlo y reglas para la factura global del día. Confirmá los valores vigentes en el sitio de ARCA antes de emitir.</p>
      </div>
      {atrasados.length > 0 && <div className="card">
        <h2 style={{ marginTop: 0 }}>Días anteriores con pendiente: {ars(totalAtrasado)}</h2>
        <table><tbody>{atrasados.map(x => <tr key={x.fecha}><td>{x.fecha}</td><td className="n">{ars(x.falta_total)}</td><td><a href="#" onClick={e => { e.preventDefault(); setSel(x.fecha); window.scrollTo(0, 0); }}>facturar</a></td></tr>)}</tbody></table>
      </div>}
    </>
  );
}
