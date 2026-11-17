import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { ars } from '../lib/semaforo';

type Mov = { id: string; fecha: string; medio: string; sentido: 'cobro' | 'pago'; importe: number; contraparte: string | null; clasificacion: string };
const CLAS: [string, string][] = [['sin_clasificar', 'Sin clasificar'], ['venta', 'Venta'], ['transferencia_propia', 'Transferencia propia'], ['compra_proveedor', 'Pago a proveedor'], ['gasto', 'Gasto'], ['otro', 'Otro']];
const MEDIOS: [string, string][] = [['mercado_pago', 'Mercado Pago'], ['transferencia', 'Transferencia'], ['qr', 'QR'], ['tarjeta', 'Tarjeta crédito'], ['debito', 'Débito'], ['otro', 'Otro']];
const hoy = () => new Date().toISOString().slice(0, 10);

export default function Cobros() {
  const { comercio } = useAuth();
  const [lista, setLista] = useState<Mov[]>([]);
  const [f, setF] = useState({ fecha: hoy(), medio: 'mercado_pago', sentido: 'cobro', importe: '', contraparte: '' });
  const [err, setErr] = useState('');
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const cargar = async () => {
    const { data } = await supabase.from('cobros_pagos_electronicos').select('id,fecha,medio,sentido,importe,contraparte,clasificacion').order('fecha', { ascending: false }).limit(200);
    setLista((data ?? []) as Mov[]);
  };
  useEffect(() => { cargar(); }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault(); setErr('');
    const { error } = await supabase.from('cobros_pagos_electronicos').insert({ comercio_id: comercio!.id, fecha: f.fecha, medio: f.medio, sentido: f.sentido, importe: Number(f.importe), contraparte: f.contraparte || null });
    if (error) setErr(error.message); else { setF({ ...f, importe: '', contraparte: '' }); cargar(); }
  }
  async function clasificar(id: string, clasificacion: string) {
    await supabase.from('cobros_pagos_electronicos').update({ clasificacion }).eq('id', id); cargar();
  }
  const sin = lista.filter(m => m.clasificacion === 'sin_clasificar').length;
  return (
    <>
      <h1>Cobros y pagos electrónicos</h1>
      <p className="mut">Anotá lo que cobrás o pagás por Mercado Pago, transferencia, QR o tarjeta, para ordenarlo con lo que ven los bancos y billeteras. Las ventas en efectivo las anotás en “Vender”.</p>
      <form className="card" onSubmit={guardar}>
        <div className="row">
          <div><label>Fecha</label><input type="date" value={f.fecha} onChange={set('fecha')} required /></div>
          <div><label>Tipo</label><select value={f.sentido} onChange={set('sentido')}><option value="cobro">Cobro</option><option value="pago">Pago</option></select></div>
          <div><label>Medio</label><select value={f.medio} onChange={set('medio')}>{MEDIOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
          <div><label>Importe</label><input type="number" step="0.01" min="0.01" value={f.importe} onChange={set('importe')} required /></div>
          <div><label>Quién (opcional)</label><input value={f.contraparte} onChange={set('contraparte')} /></div>
        </div>
        {err && <p className="err">{err}</p>}<button>Guardar</button>
      </form>
      {sin > 0 && <p className="err">Tenés {sin} sin clasificar. Clasificalos para que los cálculos sean correctos.</p>}
      <div className="card"><table><thead><tr><th>Fecha</th><th>Detalle</th><th className="n">Importe</th><th>Qué es</th></tr></thead><tbody>
        {lista.map(m => <tr key={m.id}><td>{m.fecha}</td><td>{m.sentido === 'cobro' ? 'Cobro' : 'Pago'} · {MEDIOS.find(x => x[0] === m.medio)?.[1]}{m.contraparte ? ' · ' + m.contraparte : ''}</td>
          <td className="n">{ars(Number(m.importe))}</td>
          <td><select value={m.clasificacion} onChange={e => clasificar(m.id, e.target.value)}>{CLAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></td></tr>)}
        {!lista.length && <tr><td colSpan={4} className="mut">Todavía no cargaste movimientos.</td></tr>}
      </tbody></table></div>
    </>
  );
}
