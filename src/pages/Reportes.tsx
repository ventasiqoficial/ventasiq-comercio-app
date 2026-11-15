import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ars } from '../lib/semaforo';
import { ETIQUETAS } from './Vender';

type Rep = { cantidad: number; total: number; por_medio: Record<string, number>; por_dia: { fecha: string; total: number }[];
  mas_vendidos: { producto: string; cantidad: number; importe: number }[]; ganancia: number; importe_con_costo: number };
type Stock = { valor_a_costo: number; valor_a_precio: number; productos: number; bajo_minimo: { producto: string; stock: number; minimo: number }[] };

const iso = (d: Date) => d.toLocaleDateString('en-CA');
const hoy = () => new Date();
const rangos: Record<string, () => [string, string]> = {
  'Hoy': () => [iso(hoy()), iso(hoy())],
  'Últimos 7 días': () => { const d = hoy(); d.setDate(d.getDate() - 6); return [iso(d), iso(hoy())]; },
  'Este mes': () => { const d = hoy(); return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(d)]; },
  'Mes anterior': () => { const d = hoy(); return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))]; },
};

export default function Reportes() {
  const [rango, setRango] = useState('Este mes');
  const [desde, setDesde] = useState(rangos['Este mes']()[0]);
  const [hasta, setHasta] = useState(rangos['Este mes']()[1]);
  const [rep, setRep] = useState<Rep | null>(null);
  const [stock, setStock] = useState<Stock | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setErr('');
    supabase.rpc('reporte_ventas', { p_desde: desde, p_hasta: hasta }).then(({ data, error }) => { if (error) setErr(error.message); else setRep(data as Rep); });
  }, [desde, hasta]);
  useEffect(() => { supabase.rpc('reporte_stock').then(({ data }) => setStock(data as Stock)); }, []);

  const elegir = (k: string) => { setRango(k); const [d, h] = rangos[k](); setDesde(d); setHasta(h); };
  const maxDia = Math.max(1, ...(rep?.por_dia ?? []).map(d => Number(d.total)));
  const margen = rep && Number(rep.importe_con_costo) > 0 ? Number(rep.ganancia) / Number(rep.importe_con_costo) : null;
  const cobertura = rep && Number(rep.total) > 0 ? Number(rep.importe_con_costo) / Number(rep.total) : 0;

  return (
    <>
      <h1>Reportes</h1>
      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.keys(rangos).map(k => <button key={k} type="button" className={rango === k ? '' : 'sec'} style={{ margin: 0 }} onClick={() => elegir(k)}>{k}</button>)}
        </div>
        <div className="row"><div><label>Desde</label><input type="date" value={desde} onChange={e => { setRango(''); setDesde(e.target.value); }} /></div>
          <div><label>Hasta</label><input type="date" value={hasta} onChange={e => { setRango(''); setHasta(e.target.value); }} /></div></div>
      </div>
      {err && <p className="err">{err}</p>}
      {rep && <>
        <div className="card">
          <h2>Vendiste {ars(Number(rep.total))}</h2>
          <p className="mut">{rep.cantidad} ventas · ticket promedio {rep.cantidad ? ars(Number(rep.total) / rep.cantidad) : '—'}</p>
          {Object.entries(rep.por_medio).map(([k, v]) => <div key={k} className="mut">{ETIQUETAS[k] ?? k}: {ars(Number(v))}</div>)}
        </div>
        <div className="card">
          <h2>Ganancia</h2>
          {margen === null ? <p className="mut">Para ver la ganancia, cargá el <b>costo</b> de tus productos (en «Productos» o importando el Excel).</p> : <>
            <p style={{ fontSize: '1.4rem', margin: '4px 0' }}>{ars(Number(rep.ganancia))} <span className="mut" style={{ fontSize: '1rem' }}>· margen {(margen * 100).toFixed(0)}%</span></p>
            {cobertura < 0.95 && <p className="mut">Calculada sobre las ventas con costo cargado ({(cobertura * 100).toFixed(0)}% de lo vendido).</p>}
          </>}
        </div>
        {rep.por_dia.length > 1 && <div className="card"><h2>Ventas por día</h2>
          {rep.por_dia.map(d => <div key={d.fecha} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '.85rem' }}>
            <span style={{ width: 52 }}>{new Date(d.fecha + 'T12:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>
            <div className="bar" style={{ flex: 1 }}><i style={{ width: `${(Number(d.total) / maxDia) * 100}%`, background: 'var(--flame)' }} /></div>
            <span style={{ width: 90, textAlign: 'right' }}>{ars(Number(d.total))}</span></div>)}
        </div>}
        <div className="card"><h2>Lo más vendido</h2>
          <table><tbody>{rep.mas_vendidos.map(m => <tr key={m.producto}><td>{m.producto}</td><td className="n">{Number(m.cantidad)} u.</td><td className="n">{ars(Number(m.importe))}</td></tr>)}
            {!rep.mas_vendidos.length && <tr><td className="mut">Todavía no hay ventas con productos en este período.</td></tr>}</tbody></table>
        </div>
      </>}
      {stock && <div className="card"><h2>Stock</h2>
        <p className="mut">{stock.productos} productos activos · a costo {ars(Number(stock.valor_a_costo))} · a precio de venta {ars(Number(stock.valor_a_precio))}</p>
        {stock.bajo_minimo.length > 0 ? <><b>Para reponer:</b><table><tbody>{stock.bajo_minimo.map(p => <tr key={p.producto}><td>{p.producto}</td><td className="n err">{Number(p.stock)} (mín. {Number(p.minimo)})</td></tr>)}</tbody></table></>
          : <p className="msg">Ningún producto por debajo del mínimo.</p>}
      </div>}
    </>
  );
}
