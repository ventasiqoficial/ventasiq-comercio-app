import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ars } from '../lib/semaforo';
import { useAuth } from '../auth';
import { encolarVenta, esErrorDeRed, guardarCache, leerCache, nuevoId, type VentaPayload } from '../lib/offline';
import LectorBarras from '../components/LectorBarras';

export type Producto = { id: string; nombre: string; codigo: string | null; precio_venta: number; costo: number; stock_actual: number; stock_minimo: number; activo: boolean };
export const MEDIOS: [string, string][] = [['efectivo', 'Efectivo'], ['mercado_pago', 'Mercado Pago'], ['qr', 'QR'], ['transferencia', 'Transferencia'], ['debito', 'Débito'], ['tarjeta', 'Crédito']];
export const ETIQUETAS: Record<string, string> = { ...Object.fromEntries(MEDIOS), cuenta_corriente: 'Fiado', mixto: 'Varios medios', otro: 'Otro' };
type Linea = { producto: Producto; cantidad: number };
type Fila = { medio: string; importe: string };
type Cliente = { id: string; nombre: string };
const COLS = 'id,nombre,codigo,precio_venta,costo,stock_actual,stock_minimo,activo';
const r2 = (n: number) => Math.round(n * 100) / 100;

export default function Vender() {
  const { comercio } = useAuth();
  const cid = comercio!.id;
  const [prods, setProds] = useState<Producto[]>(() => leerCache<Producto[]>('productos', cid, []));
  const [clientes, setClientes] = useState<Cliente[]>(() => leerCache<Cliente[]>('clientes', cid, []));
  const [q, setQ] = useState('');
  const [carro, setCarro] = useState<Linea[]>([]);
  const [libre, setLibre] = useState('');
  const [modo, setModo] = useState<'simple' | 'dividido'>('simple');
  const [medio, setMedio] = useState('efectivo');
  const [recibido, setRecibido] = useState('');
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cliente, setCliente] = useState('');
  const [camara, setCamara] = useState(false);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [ocupado, setOcupado] = useState(false);
  const busq = useRef<HTMLInputElement>(null);

  const cargar = async () => {
    const [p, c] = await Promise.all([
      supabase.from('productos').select(COLS).eq('activo', true).order('nombre'),
      supabase.from('clientes').select('id,nombre').order('nombre'),
    ]);
    if (!p.error) { setProds((p.data ?? []) as Producto[]); guardarCache('productos', cid, p.data ?? []); }
    if (!c.error) { setClientes((c.data ?? []) as Cliente[]); guardarCache('clientes', cid, c.data ?? []); }
  };
  useEffect(() => { cargar(); }, []);

  const MAX_RESULTADOS = 8;
  const coincidencias = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? prods.filter(p => p.nombre.toLowerCase().includes(t) || (p.codigo ?? '').toLowerCase().includes(t)) : [];
  }, [prods, q]);
  const filtrados = coincidencias.slice(0, MAX_RESULTADOS);
  const hayMas = coincidencias.length > MAX_RESULTADOS;
  const totalCarro = r2(carro.reduce((s, l) => s + l.cantidad * Number(l.producto.precio_venta), 0));
  const total = totalCarro > 0 ? totalCarro : r2(Number(libre || 0));

  const agregar = (p: Producto) => setCarro(c => c.some(l => l.producto.id === p.id) ? c.map(l => l.producto.id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l) : [...c, { producto: p, cantidad: 1 }]);
  const cambiar = (id: string, d: number) => setCarro(c => c.map(l => l.producto.id === id ? { ...l, cantidad: l.cantidad + d } : l).filter(l => l.cantidad > 0));

  // Código leído (cámara o lector USB): suma el producto; si no existe, avisa
  const porCodigo = (codigo: string): boolean => {
    const p = prods.find(x => (x.codigo ?? '').trim() === codigo.trim());
    if (p) { agregar(p); setMsg(`Agregado: ${p.nombre}`); setErr(''); return true; }
    setErr(`No hay ningún producto con el código ${codigo}. Cargalo en «Productos».`); setMsg(''); return false;
  };
  const alEnter = () => {
    const t = q.trim(); if (!t) return;
    if (prods.some(x => (x.codigo ?? '').trim() === t)) { porCodigo(t); setQ(''); return; }
    if (filtrados.length === 1) { agregar(filtrados[0]); setQ(''); }
  };

  const cambiarModo = (m: 'simple' | 'dividido') => {
    setModo(m);
    if (m === 'dividido' && !filas.length) setFilas([{ medio: 'efectivo', importe: '' }, { medio: 'mercado_pago', importe: '' }]);
  };
  const sumaFilas = r2(filas.reduce((s, f) => s + Number(f.importe || 0), 0));
  const resto = r2(total - sumaFilas);
  const usaFiado = modo === 'simple' ? medio === 'cuenta_corriente' : filas.some(f => f.medio === 'cuenta_corriente');
  const vuelto = modo === 'simple' && medio === 'efectivo' && Number(recibido) > total ? r2(Number(recibido) - total) : 0;
  const pagosOk = modo === 'simple' || (filas.length >= 2 && resto === 0 && filas.every(f => Number(f.importe) > 0));
  const puede = total > 0 && pagosOk && (!usaFiado || !!cliente);

  async function cobrar() {
    setErr(''); setMsg(''); setOcupado(true);
    const pagos = modo === 'simple' ? [{ medio, importe: total }] : filas.map(f => ({ medio: f.medio, importe: Number(f.importe) }));
    const payload: VentaPayload = {
      p_id: nuevoId(), p_medio: pagos[0].medio, p_total: totalCarro > 0 ? null : total, p_fecha: new Date().toLocaleDateString('en-CA'),
      p_items: carro.map(l => ({ producto_id: l.producto.id, cantidad: l.cantidad, precio_unitario: Number(l.producto.precio_venta) })),
      p_pagos: pagos, p_cliente_id: usaFiado ? cliente : null,
    };
    let guardadaSinInternet = false;
    if (!navigator.onLine) { encolarVenta(payload); guardadaSinInternet = true; }
    else {
      const { error } = await supabase.rpc('registrar_venta', payload);
      if (error) {
        if (esErrorDeRed(error.message)) { encolarVenta(payload); guardadaSinInternet = true; }
        else { setOcupado(false); setErr(error.message); return; }
      }
    }
    setOcupado(false);
    // Stock en pantalla (también sin internet)
    const restar = new Map(carro.map(l => [l.producto.id, l.cantidad]));
    const nuevos = prods.map(p => restar.has(p.id) ? { ...p, stock_actual: Number(p.stock_actual) - (restar.get(p.id) ?? 0) } : p);
    setProds(nuevos); guardarCache('productos', cid, nuevos);
    setMsg((guardadaSinInternet ? 'Sin internet: venta guardada en este equipo, se envía sola al volver la conexión. ' : 'Venta registrada. ') +
      `${ars(total)}${vuelto ? ` — vuelto: ${ars(vuelto)}` : ''}`);
    setCarro([]); setLibre(''); setQ(''); setRecibido(''); setCliente(''); setModo('simple'); setFilas([]); busq.current?.focus();
    if (!guardadaSinInternet) cargar();
  }

  return (
    <>
      <h1>Vender</h1>
      <div className="card">
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={busq} placeholder="Buscar por nombre, o escaneá / escribí el código…" value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); alEnter(); } }} />
          <button type="button" className="sec" style={{ margin: 0, whiteSpace: 'nowrap' }} onClick={() => setCamara(c => !c)}>{camara ? 'Cerrar cámara' : 'Cámara'}</button>
        </div>
        {q.trim() === '' && <p className="mut" style={{ margin: '8px 0 0' }}>{prods.length ? 'Escribí el nombre o escaneá el código para buscar entre tus productos.' : 'Todavía no cargaste productos. Podés vender por monto abajo, o cargarlos en «Productos».'}</p>}
        {q.trim() !== '' && <div style={{ marginTop: 8, border: '1px solid var(--line, #d6dcdb)', borderRadius: 8, overflow: 'hidden' }}>
          {filtrados.map(p => <button key={p.id} type="button" className="sec" style={{ margin: 0, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 8, textAlign: 'left', borderRadius: 0, border: 0, borderBottom: '1px solid var(--line, #d6dcdb)' }} onClick={() => { agregar(p); setQ(''); busq.current?.focus(); }}>
            <span>{p.nombre}{p.codigo ? <span className="mut"> · {p.codigo}</span> : null}</span><b>{ars(Number(p.precio_venta))}</b></button>)}
          {!filtrados.length && <p className="mut" style={{ margin: 8 }}>Sin resultados para «{q.trim()}».</p>}
          {hayMas && <p className="mut" style={{ margin: 8 }}>Hay más coincidencias: seguí escribiendo para acotar.</p>}
        </div>}
      </div>
      {camara && <LectorBarras alLeer={porCodigo} alCerrar={() => setCamara(false)} />}
      {carro.length > 0 && <div className="card"><table><tbody>
        {carro.map(l => <tr key={l.producto.id}><td>{l.producto.nombre}</td>
          <td><button type="button" className="sec" style={{ margin: 0, padding: '2px 10px' }} onClick={() => cambiar(l.producto.id, -1)}>−</button> {l.cantidad} <button type="button" className="sec" style={{ margin: 0, padding: '2px 10px' }} onClick={() => cambiar(l.producto.id, 1)}>+</button></td>
          <td className="n">{ars(l.cantidad * Number(l.producto.precio_venta))}</td></tr>)}
      </tbody></table></div>}
      {carro.length === 0 && <div className="card"><label>O cargá solo el monto de la venta</label><input type="number" min="0" step="0.01" inputMode="decimal" value={libre} onChange={e => setLibre(e.target.value)} placeholder="$" /></div>}

      <div className="card">
        <div className="tabs">
          <button type="button" className={modo === 'simple' ? '' : 'sec'} style={{ margin: 0 }} onClick={() => cambiarModo('simple')}>Un solo medio</button>
          <button type="button" className={modo === 'dividido' ? '' : 'sec'} style={{ margin: 0 }} onClick={() => cambiarModo('dividido')}>Pago dividido</button>
        </div>
        <h2>Total: {ars(total)}</h2>

        {modo === 'simple' && <>
          <label>¿Cómo pagó?</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[...MEDIOS, ['cuenta_corriente', 'Fiado'] as [string, string]].map(([v, t]) => <button key={v} type="button" className={medio === v ? '' : 'sec'} style={{ margin: 0 }} onClick={() => setMedio(v)}>{t}</button>)}
          </div>
          {medio === 'efectivo' && <>
            <label>Paga con (opcional, para calcular el vuelto)</label>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={recibido} onChange={e => setRecibido(e.target.value)} placeholder="$" />
            {vuelto > 0 && <p style={{ fontSize: '1.3rem', fontWeight: 700 }}>Vuelto: {ars(vuelto)}</p>}
          </>}
        </>}

        {modo === 'dividido' && <>
          {filas.map((f, i) => <div key={i} className="row" style={{ gridTemplateColumns: '1fr 1fr auto', alignItems: 'end' }}>
            <div><label>Medio</label><select value={f.medio} onChange={e => setFilas(filas.map((x, k) => k === i ? { ...x, medio: e.target.value } : x))}>
              {[...MEDIOS, ['cuenta_corriente', 'Fiado'] as [string, string]].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
            <div><label>Importe</label><input type="number" min="0" step="0.01" inputMode="decimal" value={f.importe} onChange={e => setFilas(filas.map((x, k) => k === i ? { ...x, importe: e.target.value } : x))} /></div>
            <button type="button" className="sec" style={{ margin: 0 }} disabled={filas.length <= 2} onClick={() => setFilas(filas.filter((_, k) => k !== i))}>✕</button>
          </div>)}
          <button type="button" className="sec" onClick={() => setFilas([...filas, { medio: 'debito', importe: resto > 0 ? String(resto) : '' }])}>+ Agregar medio</button>
          <p className={resto === 0 ? 'msg' : 'err'}>{resto === 0 ? 'Los pagos suman el total.' : resto > 0 ? `Faltan ${ars(resto)} para completar el total.` : `Se pasa por ${ars(-resto)}.`}</p>
        </>}

        {usaFiado && <>
          <label>Cliente (el fiado se anota en su cuenta)</label>
          <select value={cliente} onChange={e => setCliente(e.target.value)}>
            <option value="">Elegí un cliente…</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {!clientes.length && <p className="mut">Primero cargá el cliente en «Contactos → Clientes».</p>}
        </>}

        {err && <p className="err">{err}</p>}{msg && <p className="msg">{msg}</p>}
        <button disabled={ocupado || !puede} onClick={cobrar} style={{ width: '100%' }}>Cobrar</button>
        <p className="mut">Anotá todas las ventas, también las de efectivo: así el sistema te muestra cuánto te falta facturar.</p>
      </div>
    </>
  );
}
