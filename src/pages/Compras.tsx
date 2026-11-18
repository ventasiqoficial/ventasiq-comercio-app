import { TIPOS_COMPRA, CODIGOS_NC } from '../lib/comprobantes';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { ars } from '../lib/semaforo';
import { leerQR, qrDesdeArchivo } from '../lib/qr';
import Escaner from '../components/Escaner';

type Compra = { id: string; fecha: string; cuit_emisor: string; tipo_comprobante: string; punto_venta: number; numero: number; total: number; es_nota_credito: boolean };
const hoy = () => new Date().toISOString().slice(0, 10);

export default function Compras() {
  const { comercio } = useAuth();
  const [lista, setLista] = useState<Compra[]>([]);
  const [f, setF] = useState({ fecha: hoy(), cuit: '', tipo: '001', pv: '', numero: '', neto: '', iva: '', perc: '', total: '', nc: false });
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [camara, setCamara] = useState(false);
  const [link, setLink] = useState('');
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const cargar = async () => {
    const { data } = await supabase.from('compras').select('id,fecha,cuit_emisor,tipo_comprobante,punto_venta,numero,total,es_nota_credito').order('fecha', { ascending: false }).limit(100);
    setLista((data ?? []) as Compra[]);
  };
  useEffect(() => { cargar(); }, []);

  function aplicarQR(texto: string): boolean {
    setErr(''); setInfo('');
    const r = leerQR(texto);
    if (typeof r === 'string') { setErr(r); return false; }
    setCamara(false);
    setF(prev => ({ ...prev, fecha: r.fecha, cuit: r.cuit, tipo: String(r.tipoCmp).padStart(3, '0'), pv: String(r.ptoVta), numero: String(r.nroCmp),
      neto: '', iva: '', perc: '', total: String(r.totalPesos), nc: r.esNotaCredito }));
    setInfo(`Leímos la factura por ${ars(r.totalPesos)}. Revisá los datos y apretá "Guardar compra".` + ' Si querés, completá neto, IVA y percepciones.' +
      (r.moneda !== 'PES' ? ` Está en ${r.moneda}: la pasamos a pesos con la cotización del comprobante.` : ''));
    return true;
  }
  async function deArchivo(file?: File) {
    if (!file) return; setErr(''); setInfo('Buscando el QR…');
    try { const t = await qrDesdeArchivo(file); if (t) aplicarQR(t); else { setInfo(''); setErr('No encontramos un QR en ese archivo. Probá con una foto más nítida, escaneá con la cámara o cargala a mano.'); } }
    catch { setInfo(''); setErr('No pudimos leer ese archivo.'); }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault(); setErr('');
    const neto = Number(f.neto || 0), iva = Number(f.iva || 0), perc = Number(f.perc || 0);
    const total = f.total ? Number(f.total) : neto + iva + perc;
    const { data, error } = await supabase.from('compras').insert({ comercio_id: comercio!.id, fecha: f.fecha, cuit_emisor: f.cuit.replace(/\D/g, ''),
      tipo_comprobante: f.tipo, punto_venta: Number(f.pv || 0), numero: Number(f.numero), neto, iva, percepciones_total: perc, total, es_nota_credito: f.nc }).select('id').single();
    if (error) { setErr(error.code === '23505' ? 'Esa factura ya está cargada.' : error.message); return; }
    if (perc > 0 && data) await supabase.from('percepciones').insert({ comercio_id: comercio!.id, compra_id: data.id, tipo: 'otra', fecha: f.fecha, importe: perc });
    setF({ ...f, numero: '', neto: '', iva: '', perc: '', total: '', nc: false }); cargar();
  }
  async function borrar(id: string) { await supabase.from('compras').delete().eq('id', id); cargar(); }

  return (
    <>
      <h1>Compras</h1>
      <p className="mut">Cargá las facturas de tus proveedores. Podés importarlas todas juntas desde “Facturación”.</p>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Cargar con el QR de la factura</h2>
        <p className="mut">Las facturas y tickets electrónicos traen un código QR de ARCA. Leerlo completa los datos solo.</p>
        <button type="button" onClick={() => setCamara(true)}>Escanear con la cámara</button>{' '}
        <label className="btn sec" style={{ display: 'inline-block', color: 'var(--ink)', background: '#fff', border: '1.5px solid var(--ink)', cursor: 'pointer', margin: '.8rem 0 0' }}>
          Subir foto o PDF<input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => { deArchivo(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <label>…o pegá el link del QR</label>
        <input value={link} onChange={e => setLink(e.target.value)} onPaste={e => { const t = e.clipboardData.getData('text'); if (t) { e.preventDefault(); setLink(''); aplicarQR(t); } }} placeholder="https://www.arca.gob.ar/fe/qr/?p=…" />
        {link && <button type="button" className="sec" onClick={() => { aplicarQR(link); setLink(''); }}>Leer link</button>}
        {info && <p className="msg">{info}</p>}
      </div>
      {camara && <Escaner alLeer={aplicarQR} alCerrar={() => setCamara(false)} />}
      <form className="card" onSubmit={guardar}>
        <div className="row">
          <div><label>Fecha</label><input type="date" value={f.fecha} onChange={set('fecha')} required /></div>
          <div><label>CUIT proveedor</label><input value={f.cuit} onChange={set('cuit')} required inputMode="numeric" /></div>
          <div><label>Tipo de comprobante</label><select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value, nc: CODIGOS_NC.includes(e.target.value) })}>
            {!TIPOS_COMPRA.some(([v]) => v === f.tipo) && <option value={f.tipo}>Código {f.tipo}</option>}
            {TIPOS_COMPRA.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            <small className="mut">Figura arriba en la factura del proveedor (A, B o C).</small></div>
          <div><label>Punto de venta</label><input type="number" value={f.pv} onChange={set('pv')} />
            <small className="mut">Primer número de la factura (en 00003-00000125 es el 3).</small></div>
          <div><label>Número de factura</label><input type="number" value={f.numero} onChange={set('numero')} required /></div>
          <div><label>Neto</label><input type="number" step="0.01" value={f.neto} onChange={set('neto')} />
            {Number(f.neto) > 0 && <small className="mut">{ars(Number(f.neto))}</small>}</div>
          <div><label>IVA</label><input type="number" step="0.01" value={f.iva} onChange={set('iva')} />
            {Number(f.iva) > 0 && <small className="mut">{ars(Number(f.iva))}</small>}</div>
          <div><label>Percepciones</label><input type="number" step="0.01" value={f.perc} onChange={set('perc')} /></div>
          <div><label>Total (si lo dejás vacío se suma)</label><input type="number" step="0.01" value={f.total} onChange={set('total')} />
            {Number(f.total) > 0 && <small className="mut">Total: <b>{ars(Number(f.total))}</b></small>}</div>
        </div>
        <label><input type="checkbox" style={{ width: 'auto' }} checked={f.nc} onChange={e => setF({ ...f, nc: e.target.checked })} /> Es nota de crédito</label>
        {err && <p className="err">{err}</p>}<button>Guardar compra</button>
      </form>
      <div className="card"><table><thead><tr><th>Fecha</th><th>Proveedor</th><th>Comprobante</th><th className="n">Total</th><th /></tr></thead><tbody>
        {lista.map(c => <tr key={c.id}><td>{c.fecha}</td><td>{c.cuit_emisor}</td><td>{c.tipo_comprobante}-{c.punto_venta}-{c.numero}{c.es_nota_credito ? ' (NC)' : ''}</td>
          <td className="n">{ars(Number(c.total))}</td><td><a href="#" onClick={e => { e.preventDefault(); borrar(c.id); }}>borrar</a></td></tr>)}
        {!lista.length && <tr><td colSpan={5} className="mut">Todavía no cargaste compras.</td></tr>}
      </tbody></table></div>
    </>
  );
}
