import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { ars } from '../lib/semaforo';
import type { Producto } from './Vender';
import { leerProductosExcel, PLANILLA_EJEMPLO, type ProductoImport } from '../lib/productos';

export default function Productos() {
  const { comercio, rol } = useAuth();
  const dueno = rol === 'dueno';
  const [lista, setLista] = useState<Producto[]>([]);
  const [f, setF] = useState({ nombre: '', codigo: '', precio: '', costo: '', stock: '', minimo: '' });
  const [err, setErr] = useState('');
  const [imp, setImp] = useState<{ productos: ProductoImport[]; sinReconocer: string[] } | null>(null);
  const [resImp, setResImp] = useState('');
  const [aj, setAj] = useState({ pct: '', campo: 'precio', red: '0', alcance: 'todos' });
  const [msgAj, setMsgAj] = useState('');
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const cargar = async () => {
    const { data } = await supabase.from('productos').select('id,nombre,codigo,precio_venta,costo,stock_actual,stock_minimo,activo').order('nombre');
    setLista((data ?? []) as Producto[]);
  };
  useEffect(() => { cargar(); }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault(); setErr('');
    const { data, error } = await supabase.from('productos').insert({ comercio_id: comercio!.id, nombre: f.nombre.trim(), codigo: f.codigo.trim() || null,
      precio_venta: Number(f.precio || 0), costo: Number(f.costo || 0), stock_minimo: Number(f.minimo || 0) }).select('id').single();
    if (error) { setErr(error.code === '23505' ? 'Ya hay un producto con ese código.' : error.message); return; }
    if (Number(f.stock) > 0 && data) await supabase.from('movimientos_stock').insert({ comercio_id: comercio!.id, producto_id: data.id, tipo: 'ajuste', cantidad: Number(f.stock), referencia: 'stock inicial' });
    setF({ nombre: '', codigo: '', precio: '', costo: '', stock: '', minimo: '' }); cargar();
  }
  async function ajustar(p: Producto) {
    const t = prompt(`Stock actual de "${p.nombre}": ${p.stock_actual}. ¿Cuántas unidades querés sumar (o restar con signo −)?`);
    const n = Number(t?.replace(',', '.')); if (!t || !isFinite(n) || n === 0) return;
    await supabase.from('movimientos_stock').insert({ comercio_id: comercio!.id, producto_id: p.id, tipo: 'ajuste', cantidad: n, referencia: 'ajuste manual' }); cargar();
  }
  async function precio(p: Producto) {
    const t = prompt(`Nuevo precio de "${p.nombre}" (hoy ${ars(Number(p.precio_venta))}):`);
    const n = Number(t?.replace(',', '.')); if (!t || !isFinite(n) || n < 0) return;
    await supabase.from('productos').update({ precio_venta: n }).eq('id', p.id); cargar();
  }

  async function elegirArchivo(e: { target: HTMLInputElement }) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    setErr(''); setResImp(''); setImp(null);
    try { const r = await leerProductosExcel(file); if (!r.productos.length) setErr('No encontramos productos. La planilla necesita una columna «Nombre» y otra de «Precio» o «Código».'); else setImp(r); }
    catch (x) { setErr(x instanceof Error ? x.message : 'No pudimos leer el archivo.'); }
  }
  async function confirmarImport() {
    if (!imp) return; setErr('');
    const { data, error } = await supabase.rpc('importar_productos', { p_items: imp.productos });
    if (error) { setErr(error.message); return; }
    const r = data as { creados: number; actualizados: number; omitidos: number };
    setResImp(`Listo: ${r.creados} nuevos, ${r.actualizados} actualizados${r.omitidos ? `, ${r.omitidos} omitidos` : ''}.`); setImp(null); cargar();
  }
  async function descargarPlanilla() {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');
    await writeXlsxFile(PLANILLA_EJEMPLO.map((f, i) => f.map(v => ({ value: v, fontWeight: i === 0 ? 'bold' as const : undefined })))).toFile('planilla-productos.xlsx');
  }
  const pctNum = Number(aj.pct.replace(',', '.'));
  const ejemplo = lista.find(p => p.activo && Number(p.precio_venta) > 0);
  const redondear = (n: number) => { const r = Number(aj.red); return r > 0 ? Math.round(n / r) * r : Math.round(n * 100) / 100; };
  async function aplicarAjuste() {
    setMsgAj(''); if (!isFinite(pctNum) || pctNum === 0) return;
    if (!confirm(`¿Cambiar ${aj.campo === 'precio' ? 'los precios' : aj.campo === 'costo' ? 'los costos' : 'precios y costos'} un ${pctNum}% en ${aj.alcance === 'todos' ? 'todos los productos' : 'los productos visibles'}?`)) return;
    const { data, error } = await supabase.rpc('actualizar_precios', { p_porcentaje: pctNum, p_ids: null, p_campo: aj.campo, p_redondeo: Number(aj.red) });
    if (error) { setMsgAj(error.message); return; }
    setMsgAj(`Listo: se actualizaron ${data} productos.`); setAj({ ...aj, pct: '' }); cargar();
  }
  async function activar(p: Producto) { await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id); cargar(); }

  return (
    <>
      <h1>Productos y stock</h1>
      <form className="card" onSubmit={guardar}>
        <div className="row">
          <div><label>Nombre</label><input value={f.nombre} onChange={set('nombre')} required /></div>
          <div><label>Código (opcional)</label><input value={f.codigo} onChange={set('codigo')} /></div>
          <div><label>Precio de venta</label><input type="number" min="0" step="0.01" value={f.precio} onChange={set('precio')} required /></div>
          <div><label>Costo (opcional)</label><input type="number" min="0" step="0.01" value={f.costo} onChange={set('costo')} /></div>
          <div><label>Stock inicial</label><input type="number" min="0" step="0.001" value={f.stock} onChange={set('stock')} /></div>
          <div><label>Avisar si queda menos de</label><input type="number" min="0" step="0.001" value={f.minimo} onChange={set('minimo')} /></div>
        </div>
        {err && <p className="err">{err}</p>}<button>Agregar producto</button>
      </form>

      {dueno && <div className="card">
        <h2>Cargar productos desde Excel</h2>
        <p className="mut">Subí tu planilla (.xlsx) con columnas como Código, Nombre, Categoría, Precio de venta, Costo, Stock y Stock mínimo. Si el código ya existe, se actualiza el precio y el costo; el stock solo se carga en productos nuevos.</p>
        <input type="file" accept=".xlsx,.csv" onChange={elegirArchivo} />
        <button type="button" className="sec" onClick={descargarPlanilla}>Descargar planilla de ejemplo</button>
        {resImp && <p className="msg">{resImp}</p>}
        {imp && <>
          <p><b>{imp.productos.length}</b> productos encontrados. Revisá las primeras filas:</p>
          {imp.sinReconocer.length > 0 && <p className="mut">Columnas que no se usan: {imp.sinReconocer.join(', ')}.</p>}
          <table><thead><tr><th>Código</th><th>Nombre</th><th className="n">Precio</th><th className="n">Costo</th><th className="n">Stock</th></tr></thead><tbody>
            {imp.productos.slice(0, 8).map((p, i) => <tr key={i}><td>{p.codigo}</td><td>{p.nombre}</td><td className="n">{p.precio}</td><td className="n">{p.costo}</td><td className="n">{p.stock}</td></tr>)}</tbody></table>
          <button type="button" onClick={confirmarImport}>Importar {imp.productos.length} productos</button> <button type="button" className="sec" onClick={() => setImp(null)}>Cancelar</button>
        </>}
      </div>}
      {dueno && <div className="card">
        <h2>Actualizar precios por porcentaje</h2>
        <div className="row">
          <div><label>Porcentaje (ej. 10 sube, −5 baja)</label><input inputMode="decimal" value={aj.pct} onChange={e => setAj({ ...aj, pct: e.target.value })} placeholder="10" /></div>
          <div><label>Qué cambiar</label><select value={aj.campo} onChange={e => setAj({ ...aj, campo: e.target.value })}><option value="precio">Precio de venta</option><option value="costo">Costo</option><option value="ambos">Precio y costo</option></select></div>
          <div><label>Redondear a</label><select value={aj.red} onChange={e => setAj({ ...aj, red: e.target.value })}><option value="0">Centavos</option><option value="1">$1</option><option value="10">$10</option><option value="50">$50</option><option value="100">$100</option></select></div>
        </div>
        {ejemplo && isFinite(pctNum) && pctNum !== 0 && <p className="mut">Ejemplo: «{ejemplo.nombre}» pasa de {ars(Number(ejemplo.precio_venta))} a {ars(redondear(Number(ejemplo.precio_venta) * (1 + pctNum / 100)))}.</p>}
        <button type="button" disabled={!isFinite(pctNum) || pctNum === 0} onClick={aplicarAjuste}>Aplicar a todos los productos</button>
        {msgAj && <p className={msgAj.startsWith('Listo') ? 'msg' : 'err'}>{msgAj}</p>}
      </div>}
      <div className="card"><table><thead><tr><th>Producto</th><th className="n">Precio</th><th className="n">Stock</th><th /></tr></thead><tbody>
        {lista.map(p => { const bajo = p.activo && Number(p.stock_minimo) > 0 && Number(p.stock_actual) <= Number(p.stock_minimo);
          return <tr key={p.id} style={{ opacity: p.activo ? 1 : .5 }}>
            <td>{p.nombre}{p.codigo ? <span className="mut"> · {p.codigo}</span> : null}</td>
            <td className="n">{dueno ? <a href="#" onClick={e => { e.preventDefault(); precio(p); }}>{ars(Number(p.precio_venta))}</a> : ars(Number(p.precio_venta))}</td>
            <td className="n" style={bajo ? { color: 'var(--ur)', fontWeight: 700 } : undefined}>{Number(p.stock_actual)}{bajo ? ' ⚠' : ''}</td>
            <td><a href="#" onClick={e => { e.preventDefault(); ajustar(p); }}>ajustar</a> · <a href="#" onClick={e => { e.preventDefault(); activar(p); }}>{p.activo ? 'ocultar' : 'mostrar'}</a></td></tr>; })}
        {!lista.length && <tr><td colSpan={4} className="mut">Todavía no cargaste productos.</td></tr>}
      </tbody></table></div>
    </>
  );
}
