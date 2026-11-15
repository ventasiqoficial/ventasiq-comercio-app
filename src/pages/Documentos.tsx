import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { ars } from '../lib/semaforo';
import { crearPDF, LEYENDA_PRESUPUESTO, LEYENDA_REMITO, type DocPDF } from '../lib/pdf';
import type { Producto } from './Vender';

type Item = { producto_id: string | null; descripcion: string; cantidad: string; precio: string };
type Cliente = { id: string; nombre: string };
type Doc = { id: string; numero: number; fecha: string; cliente_id: string | null; estado: string; total?: number; factura_ref?: string | null; notas: string | null; validez_dias?: number };
const hoy = () => new Date().toLocaleDateString('en-CA');
const itemVacio = (): Item => ({ producto_id: null, descripcion: '', cantidad: '1', precio: '' });

export default function Documentos() {
  const { comercio } = useAuth();
  const [tipo, setTipo] = useState<'presupuestos' | 'remitos'>('presupuestos');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [prods, setProds] = useState<Producto[]>([]);
  const [lista, setLista] = useState<Doc[]>([]);
  const [cli, setCli] = useState(''); const [items, setItems] = useState<Item[]>([itemVacio()]);
  const [notas, setNotas] = useState(''); const [validez, setValidez] = useState('7'); const [ref, setRef] = useState('');
  const [err, setErr] = useState('');
  const esPres = tipo === 'presupuestos';

  const cargar = async () => {
    const { data } = await supabase.from(tipo).select('*').order('numero', { ascending: false }).limit(50);
    setLista((data ?? []) as Doc[]);
  };
  useEffect(() => {
    supabase.from('clientes').select('id,nombre').order('nombre').then(({ data }) => setClientes((data ?? []) as Cliente[]));
    supabase.from('productos').select('id,nombre,codigo,precio_venta,costo,stock_actual,stock_minimo,activo').eq('activo', true).order('nombre').then(({ data }) => setProds((data ?? []) as Producto[]));
  }, []);
  useEffect(() => { cargar(); setErr(''); }, [tipo]);

  const setItem = (i: number, k: keyof Item, v: string | null) => setItems(a => a.map((x, j) => j === i ? { ...x, [k]: v } : x));
  function elegirProducto(i: number, id: string) {
    const p = prods.find(x => x.id === id);
    setItems(a => a.map((x, j) => j === i ? { ...x, producto_id: id || null, descripcion: p ? p.nombre : x.descripcion, precio: p ? String(p.precio_venta) : x.precio } : x));
  }

  async function descargar(docId: string) {
    const { data: d } = await supabase.from(tipo).select('*').eq('id', docId).single();
    const { data: its } = await supabase.from(esPres ? 'presupuesto_items' : 'remito_items').select('*').eq(esPres ? 'presupuesto_id' : 'remito_id', docId);
    const c = clientes.find(x => x.id === d?.cliente_id);
    const spec: DocPDF = { titulo: esPres ? 'PRESUPUESTO' : 'REMITO', leyenda: esPres ? LEYENDA_PRESUPUESTO : LEYENDA_REMITO,
      comercio: { nombre: comercio!.nombre, cuit: comercio!.cuit }, numero: d.numero, fecha: d.fecha, cliente: c?.nombre ?? null, conPrecios: esPres,
      items: (its ?? []).map((x: { descripcion: string; cantidad: number; precio_unitario?: number }) => ({ descripcion: x.descripcion, cantidad: Number(x.cantidad), precio: x.precio_unitario !== undefined ? Number(x.precio_unitario) : undefined })),
      validez: esPres ? `Válido por ${d.validez_dias} días` : undefined, notas: d.notas, referencia: d.factura_ref };
    crearPDF(spec).save(`${esPres ? 'presupuesto' : 'remito'}-${String(d.numero).padStart(8, '0')}.pdf`);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault(); setErr('');
    const validos = items.filter(i => i.descripcion.trim() && Number(i.cantidad) > 0);
    if (!validos.length) { setErr('Agregá al menos un ítem con descripción y cantidad.'); return; }
    const { data: mx } = await supabase.from(tipo).select('numero').order('numero', { ascending: false }).limit(1);
    const numero = ((mx?.[0] as { numero: number } | undefined)?.numero ?? 0) + 1;
    const total = validos.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio || 0), 0);
    const cab: Record<string, unknown> = { comercio_id: comercio!.id, numero, cliente_id: cli || null, notas: notas.trim() || null };
    if (esPres) { cab.total = total; cab.validez_dias = Number(validez || 7); } else cab.factura_ref = ref.trim() || null;
    const { data, error } = await supabase.from(tipo).insert(cab).select('id').single();
    if (error || !data) { setErr(error?.message ?? 'No se pudo guardar.'); return; }
    const filas = validos.map(i => esPres
      ? { comercio_id: comercio!.id, presupuesto_id: data.id, producto_id: i.producto_id, descripcion: i.descripcion.trim(), cantidad: Number(i.cantidad), precio_unitario: Number(i.precio || 0) }
      : { comercio_id: comercio!.id, remito_id: data.id, producto_id: i.producto_id, descripcion: i.descripcion.trim(), cantidad: Number(i.cantidad) });
    const r = await supabase.from(esPres ? 'presupuesto_items' : 'remito_items').insert(filas);
    if (r.error) { setErr(r.error.message); return; }
    setItems([itemVacio()]); setNotas(''); setRef(''); await cargar(); await descargar(data.id);
  }
  async function estado(id: string, v: string) { await supabase.from(tipo).update({ estado: v }).eq('id', id); cargar(); }

  return (
    <>
      <h1>Presupuestos y remitos</h1>
      <p className="mut">Son documentos que no son facturas: el presupuesto no requiere facturación y el remito acompaña la entrega. Se descargan en PDF.</p>
      <div className="tabs">
        <button className={esPres ? '' : 'sec'} onClick={() => setTipo('presupuestos')}>Presupuestos</button>
        <button className={!esPres ? '' : 'sec'} onClick={() => setTipo('remitos')}>Remitos</button>
      </div>
      <form className="card" onSubmit={guardar}>
        <label>Cliente (opcional)</label>
        <select value={cli} onChange={e => setCli(e.target.value)}><option value="">Sin cliente</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        {items.map((it, i) => (
          <div key={i} className="row" style={{ marginTop: 8 }}>
            <div><label>Producto</label><select value={it.producto_id ?? ''} onChange={e => elegirProducto(i, e.target.value)}><option value="">Otro / escribir</option>{prods.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
            <div><label>Descripción</label><input value={it.descripcion} onChange={e => setItem(i, 'descripcion', e.target.value)} /></div>
            <div><label>Cantidad</label><input type="number" min="0" step="0.001" value={it.cantidad} onChange={e => setItem(i, 'cantidad', e.target.value)} /></div>
            {esPres && <div><label>Precio unitario</label><input type="number" min="0" step="0.01" value={it.precio} onChange={e => setItem(i, 'precio', e.target.value)} /></div>}
          </div>
        ))}
        <button type="button" className="sec" onClick={() => setItems(a => [...a, itemVacio()])}>+ Agregar ítem</button>
        {esPres
          ? <><label>Válido por (días)</label><input type="number" min="1" value={validez} onChange={e => setValidez(e.target.value)} /></>
          : <><label>Factura asociada (opcional)</label><input value={ref} onChange={e => setRef(e.target.value)} placeholder="Ej: 0001-00000123" /></>}
        <label>Notas (opcional)</label><textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)} />
        {err && <p className="err">{err}</p>}<button>Guardar y descargar PDF</button>
      </form>
      <div className="card"><table><tbody>
        {lista.map(d => <tr key={d.id}>
          <td>N° {String(d.numero).padStart(8, '0')}</td><td>{d.fecha}</td><td>{clientes.find(c => c.id === d.cliente_id)?.nombre ?? ''}</td>
          {esPres && <td className="n">{ars(Number(d.total))}</td>}
          <td><select value={d.estado} onChange={e => estado(d.id, e.target.value)}>
            {(esPres ? ['borrador', 'enviado', 'aceptado', 'rechazado', 'vencido'] : ['emitido', 'entregado', 'anulado']).map(s => <option key={s}>{s}</option>)}</select></td>
          <td><a href="#" onClick={e => { e.preventDefault(); descargar(d.id); }}>PDF</a></td></tr>)}
        {!lista.length && <tr><td className="mut">Todavía no hiciste {esPres ? 'presupuestos' : 'remitos'}.</td></tr>}
      </tbody></table></div>
    </>
  );
}
