import { useEffect, useState, type ChangeEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { ars } from '../lib/semaforo';
import { aCompras, aEmitidos, type CompraImp, type EmitidoImp } from '../lib/csv';
import { leerTabla } from '../lib/excel';

type Emitido = { id: string; fecha: string; tipo_comprobante: string; punto_venta: number; numero: number; importe: number; es_nota_credito: boolean };

export default function Facturacion() {
  const { comercio } = useAuth();
  const [lista, setLista] = useState<Emitido[]>([]);
  const [modo, setModo] = useState<'emitidos' | 'recibidos'>('emitidos');
  const [prev, setPrev] = useState<{ emitidos?: EmitidoImp[]; compras?: CompraImp[]; descartadas: number } | null>(null);
  const [msg, setMsg] = useState('');

  const cargar = async () => {
    const { data } = await supabase.from('comprobantes_emitidos').select('id,fecha,tipo_comprobante,punto_venta,numero,importe,es_nota_credito').order('fecha', { ascending: false }).limit(100);
    setLista((data ?? []) as Emitido[]);
  };
  useEffect(() => { cargar(); }, []);

  async function elegir(e: ChangeEvent<HTMLInputElement>) {
    setMsg(''); const file = e.target.files?.[0]; if (!file) return;
    let filas;
    try { filas = await leerTabla(file); } catch (er) { setMsg('Error: ' + (er instanceof Error ? er.message : 'no se pudo leer el archivo')); return; }
    if (!filas.length) { setMsg('Error: no encontramos una tabla de comprobantes en ese archivo.'); return; }
    if (modo === 'emitidos') { const r = aEmitidos(filas); setPrev({ emitidos: r.ok, descartadas: r.descartadas }); }
    else { const r = aCompras(filas); setPrev({ compras: r.ok, descartadas: r.descartadas }); }
  }
  async function confirmar() {
    if (!prev) return; const id = comercio!.id;
    const filas = prev.emitidos ?? prev.compras ?? [];
    const tabla = prev.emitidos ? 'comprobantes_emitidos' : 'compras';
    const onConflict = prev.emitidos ? 'comercio_id,tipo_comprobante,punto_venta,numero' : 'comercio_id,cuit_emisor,tipo_comprobante,punto_venta,numero';
    let n = 0;
    for (let i = 0; i < filas.length; i += 200) {
      const lote = filas.slice(i, i + 200).map(x => ({ ...x, comercio_id: id }));
      const { error } = await supabase.from(tabla).upsert(lote, { onConflict, ignoreDuplicates: true });
      if (error) { setMsg('Error: ' + error.message); return; }
      n += lote.length;
    }
    setMsg(`Listo: se procesaron ${n} comprobantes (los repetidos se ignoran).`); setPrev(null); cargar();
  }
  const filasPrev = prev?.emitidos ?? prev?.compras ?? [];
  return (
    <>
      <h1>Facturación</h1>
      <div className="card">
        <h2>Cómo hacer una factura en ARCA</h2>
        <ol>
          <li>Entrá a <b>arca.gob.ar</b> con tu CUIT y clave fiscal (la clave es solo tuya, nunca la cargues acá).</li>
          <li>Abrí el servicio <b>“Facturador” / “Comprobantes en línea”</b> (si no lo ves, agregalo desde “Administrador de relaciones”).</li>
          <li>Elegí tu punto de venta y el tipo de comprobante (Factura C para monotributo).</li>
          <li>Completá cliente, concepto e importe, y confirmá. Descargá el PDF.</li>
          <li>Una vez por mes, bajá <b>“Mis Comprobantes”</b> (emitidos y recibidos) y subilos acá abajo.</li>
        </ol>
        <p className="mut">Los nombres de los menús de ARCA pueden cambiar.</p>
      </div>
      <h2>Importar desde “Mis Comprobantes” (Excel)</h2>
      <div className="card">
        <div className="tabs"><button className={modo === 'emitidos' ? '' : 'sec'} onClick={() => { setModo('emitidos'); setPrev(null); }}>Emitidos</button>
          <button className={modo === 'recibidos' ? '' : 'sec'} onClick={() => { setModo('recibidos'); setPrev(null); }}>Recibidos (compras)</button></div>
        <p className="mut">En ARCA → Mis Comprobantes, elegí {modo === 'emitidos' ? '“Emitidos”' : '“Recibidos”'}, el período (hasta 1 año) y descargá el Excel. Subilo tal cual lo bajaste.</p>
        <input type="file" accept=".xlsx,.csv,text/csv" onChange={elegir} />
        {prev && <>
          <p>Vista previa: <b>{filasPrev.length}</b> comprobantes reconocidos, {prev.descartadas} descartados.</p>
          <table><tbody>{filasPrev.slice(0, 5).map((x, i) => <tr key={i}><td>{x.fecha}</td><td>{x.tipo_comprobante}-{x.punto_venta}-{x.numero}</td><td className="n">{ars('importe' in x ? x.importe : x.total)}</td></tr>)}</tbody></table>
          <button onClick={confirmar} disabled={!filasPrev.length}>Confirmar importación</button>
        </>}
        {msg && <p className={msg.startsWith('Error') ? 'err' : 'msg'}>{msg}</p>}
      </div>
      <h2>Comprobantes emitidos</h2>
      <div className="card"><table><tbody>
        {lista.map(c => <tr key={c.id}><td>{c.fecha}</td><td>{c.tipo_comprobante}-{c.punto_venta}-{c.numero}{c.es_nota_credito ? ' (NC)' : ''}</td><td className="n">{ars(Number(c.importe))}</td></tr>)}
        {!lista.length && <tr><td className="mut">Todavía no importaste facturas emitidas.</td></tr>}
      </tbody></table></div>
    </>
  );
}
