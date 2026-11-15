import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { CATEGORIAS } from './Alta';
import Equipo from '../components/Equipo';

export default function Configuracion() {
  const { comercio, session, recargar } = useAuth();
  const [f, setF] = useState({ nombre: comercio!.nombre, cuit: comercio!.cuit ?? '', cat: comercio!.categoria_actual ?? '', act: comercio!.tipo_actividad ?? 'venta',
    sup: String(comercio!.superficie_m2 ?? ''), ene: String(comercio!.energia_kw_anual ?? ''), alq: String(comercio!.alquiler_anual ?? '') });
  const [msg, setMsg] = useState('');
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function guardar(e: FormEvent) {
    e.preventDefault(); setMsg('');
    const { error } = await supabase.from('comercios').update({ nombre: f.nombre, cuit: f.cuit || null, categoria_actual: f.cat || null, tipo_actividad: f.act,
      superficie_m2: f.sup ? Number(f.sup) : null, energia_kw_anual: f.ene ? Number(f.ene) : null, alquiler_anual: f.alq ? Number(f.alq) : 0 }).eq('id', comercio!.id);
    setMsg(error ? 'Error: ' + error.message : 'Guardado.'); if (!error) recargar();
  }
  return (
    <>
      <h1>Configuración</h1>
      <form className="card" onSubmit={guardar}>
        <label>Nombre</label><input value={f.nombre} onChange={set('nombre')} required />
        <label>CUIT</label><input value={f.cuit} onChange={set('cuit')} pattern="\d{11}" title="11 números sin guiones" />
        <label>Categoría de monotributo</label><select value={f.cat} onChange={set('cat')}><option value="">Sin definir</option>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select>
        <label>Tipo de actividad</label><select value={f.act} onChange={set('act')}><option value="venta">Venta de bienes</option><option value="servicios">Servicios</option></select>
        <div className="row">
          <div><label>Superficie (m²)</label><input type="number" min="0" value={f.sup} onChange={set('sup')} /></div>
          <div><label>Energía anual (kW)</label><input type="number" min="0" value={f.ene} onChange={set('ene')} /></div>
          <div><label>Alquiler anual ($)</label><input type="number" min="0" value={f.alq} onChange={set('alq')} /></div>
        </div>
        {msg && <p className={msg.startsWith('Error') ? 'err' : 'msg'}>{msg}</p>}<button>Guardar</button>
      </form>
      <Equipo />
      <div className="card"><p className="mut">Sesión: {session?.user.email}</p><p className="mut">Plan: {comercio!.estado_suscripcion ?? 'en prueba'} (ver «Mi plan»)</p>
        <button className="sec" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button></div>
    </>
  );
}
