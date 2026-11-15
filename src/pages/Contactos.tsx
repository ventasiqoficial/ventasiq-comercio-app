import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { ars } from '../lib/semaforo';
import { MEDIOS } from './Vender';

type Contacto = { id: string; nombre: string; cuit: string | null; telefono: string | null; email?: string | null; saldo?: number };
type Mov = { id: string; fecha: string; tipo: string; importe: number; medio: string | null };

export default function Contactos() {
  const { comercio } = useAuth();
  const [tipo, setTipo] = useState<'proveedores' | 'clientes'>('proveedores');
  const [lista, setLista] = useState<Contacto[]>([]);
  const [f, setF] = useState({ nombre: '', cuit: '', tel: '', email: '' });
  const [err, setErr] = useState('');
  const [cobrando, setCobrando] = useState<Contacto | null>(null);
  const [c, setC] = useState({ importe: '', medio: 'efectivo' });
  const [movs, setMovs] = useState<{ id: string; lista: Mov[] } | null>(null);
  const colId = tipo === 'proveedores' ? 'cuit' : 'cuit_dni';

  const cargar = async () => {
    const { data } = await supabase.from(tipo).select('*').order('nombre');
    let saldos = new Map<string, number>();
    if (tipo === 'clientes') {
      const { data: s } = await supabase.from('clientes_saldo').select('cliente_id,saldo');
      saldos = new Map((s ?? []).map(x => [x.cliente_id as string, Number(x.saldo)]));
    }
    setLista(((data ?? []) as Record<string, string | null>[]).map(r => ({ id: r.id as string, nombre: r.nombre as string, cuit: r[colId], telefono: r.telefono, email: r.email,
      saldo: tipo === 'clientes' ? saldos.get(r.id as string) ?? 0 : undefined })));
  };
  useEffect(() => { cargar(); setErr(''); setCobrando(null); setMovs(null); }, [tipo]);

  async function guardar(e: FormEvent) {
    e.preventDefault(); setErr('');
    const fila: Record<string, string | null> = { comercio_id: comercio!.id, nombre: f.nombre.trim(), [colId]: f.cuit.trim() || null, telefono: f.tel.trim() || null };
    if (tipo === 'proveedores') fila.email = f.email.trim() || null;
    const { error } = await supabase.from(tipo).insert(fila as never);
    if (error) setErr(error.message); else { setF({ nombre: '', cuit: '', tel: '', email: '' }); cargar(); }
  }
  async function borrar(id: string) { if (confirm('¿Borrar este contacto?')) { await supabase.from(tipo).delete().eq('id', id); cargar(); } }

  async function cobrar() {
    if (!cobrando || !(Number(c.importe) > 0)) return;
    setErr('');
    const { error } = await supabase.rpc('registrar_cobro_deuda', { p_cliente_id: cobrando.id, p_importe: Number(c.importe), p_medio: c.medio });
    if (error) { setErr(error.message); return; }
    setCobrando(null); setC({ importe: '', medio: 'efectivo' }); cargar();
  }
  async function verMovs(id: string) {
    if (movs?.id === id) { setMovs(null); return; }
    const { data } = await supabase.from('cuenta_corriente_mov').select('id,fecha,tipo,importe,medio').eq('cliente_id', id).order('creado_en', { ascending: false }).limit(30);
    setMovs({ id, lista: (data ?? []) as Mov[] });
  }
  const deuda = lista.reduce((s, x) => s + Math.max(x.saldo ?? 0, 0), 0);

  return (
    <>
      <h1>Contactos</h1>
      <div className="tabs">
        <button className={tipo === 'proveedores' ? '' : 'sec'} onClick={() => setTipo('proveedores')}>Proveedores</button>
        <button className={tipo === 'clientes' ? '' : 'sec'} onClick={() => setTipo('clientes')}>Clientes y fiado</button>
      </div>
      <form className="card" onSubmit={guardar}>
        <div className="row">
          <div><label>Nombre</label><input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} required /></div>
          <div><label>{tipo === 'proveedores' ? 'CUIT' : 'CUIT o DNI'}</label><input value={f.cuit} onChange={e => setF({ ...f, cuit: e.target.value })} inputMode="numeric" /></div>
          <div><label>Teléfono</label><input value={f.tel} onChange={e => setF({ ...f, tel: e.target.value })} /></div>
          {tipo === 'proveedores' && <div><label>Email</label><input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>}
        </div>
        {err && <p className="err">{err}</p>}<button>Agregar {tipo === 'proveedores' ? 'proveedor' : 'cliente'}</button>
      </form>

      {tipo === 'clientes' && deuda > 0 && <div className="card"><h2>Te deben en total {ars(deuda)}</h2></div>}
      {cobrando && <div className="card">
        <h2>Cobrar a {cobrando.nombre}</h2>
        <p className="mut">Debe {ars(cobrando.saldo ?? 0)}. Si paga con un medio electrónico, queda registrado como cobro.</p>
        <div className="row">
          <div><label>Importe</label><input type="number" min="0" step="0.01" inputMode="decimal" value={c.importe} onChange={e => setC({ ...c, importe: e.target.value })} /></div>
          <div><label>Medio</label><select value={c.medio} onChange={e => setC({ ...c, medio: e.target.value })}>{MEDIOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
        </div>
        <button onClick={cobrar}>Registrar cobro</button> <button className="sec" onClick={() => setCobrando(null)}>Cancelar</button>
      </div>}

      <div className="card"><table><tbody>
        {lista.map(x => <Fragment key={x.id}>
          <tr><td>{x.nombre}</td><td className="mut">{x.cuit ?? ''}</td><td className="mut">{x.telefono ?? ''}</td>
            {tipo === 'clientes' && <td className="n" style={(x.saldo ?? 0) > 0 ? { color: 'var(--ur)', fontWeight: 700 } : undefined}>{(x.saldo ?? 0) !== 0 ? ars(x.saldo ?? 0) : ''}</td>}
            <td>
              {tipo === 'clientes' && <><a href="#" onClick={e => { e.preventDefault(); setCobrando(x); setC({ importe: String(Math.max(x.saldo ?? 0, 0) || ''), medio: 'efectivo' }); }}>cobrar</a> · <a href="#" onClick={e => { e.preventDefault(); verMovs(x.id); }}>cuenta</a> · </>}
              <a href="#" onClick={e => { e.preventDefault(); borrar(x.id); }}>borrar</a></td></tr>
          {movs?.id === x.id && <tr><td colSpan={5} className="mut">
            {movs.lista.length ? movs.lista.map(m => <div key={m.id}>{new Date(m.fecha + 'T12:00').toLocaleDateString('es-AR')} · {m.tipo === 'venta' ? 'Fiado' : m.tipo === 'pago' ? 'Pagó' : 'Ajuste'} · {ars(Number(m.importe))}</div>) : 'Sin movimientos.'}
          </td></tr>}
        </Fragment>)}
        {!lista.length && <tr><td className="mut">Todavía no cargaste {tipo}.</td></tr>}
      </tbody></table></div>
    </>
  );
}
