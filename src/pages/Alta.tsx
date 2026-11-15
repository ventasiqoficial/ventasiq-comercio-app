import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';

export const CATEGORIAS = 'ABCDEFGHIJK'.split('');

export default function Alta() {
  const { recargar } = useAuth();
  const [f, setF] = useState({ nombre: '', cuit: '', categoria: '', superficie: '', energia: '', alquiler: '' });
  const [err, setErr] = useState(''); const [ocupado, setOcupado] = useState(false);
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function crear(e: FormEvent) {
    e.preventDefault(); setErr(''); setOcupado(true);
    const { error } = await supabase.rpc('crear_comercio_prueba', {
      p_nombre: f.nombre, p_cuit: f.cuit || null, p_categoria: f.categoria || null,
      p_superficie_m2: f.superficie ? Number(f.superficie) : null, p_energia_kw: f.energia ? Number(f.energia) : null, p_alquiler: f.alquiler ? Number(f.alquiler) : 0,
    });
    setOcupado(false);
    if (error) setErr(error.message); else await recargar();
  }
  return (
    <main>
      <h1>Contanos de tu comercio</h1>
      <form className="card" onSubmit={crear}>
        <label>Nombre del comercio</label><input value={f.nombre} onChange={set('nombre')} required />
        <label>CUIT (11 números, opcional)</label><input value={f.cuit} onChange={set('cuit')} inputMode="numeric" pattern="\d{11}" title="11 números sin guiones" />
        <label>Categoría de monotributo actual</label>
        <select value={f.categoria} onChange={set('categoria')}><option value="">No sé / la cargo después</option>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select>
        <div className="row">
          <div><label>Superficie del local (m²)</label><input type="number" min="0" value={f.superficie} onChange={set('superficie')} /></div>
          <div><label>Energía eléctrica anual (kW)</label><input type="number" min="0" value={f.energia} onChange={set('energia')} /></div>
          <div><label>Alquiler anual ($)</label><input type="number" min="0" value={f.alquiler} onChange={set('alquiler')} /></div>
        </div>
        {err && <p className="err">{err}</p>}
        <button disabled={ocupado}>Empezar</button>
      </form>
    </main>
  );
}
