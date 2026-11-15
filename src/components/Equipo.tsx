import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';

type Miembro = { id: string; email: string | null; nombre: string | null; rol: string };
type Invitacion = { id: string; email: string };

/** Equipo del comercio: el dueño invita empleados por email. El empleado entra con ese mismo email (o con Google). */
export default function Equipo() {
  const { session } = useAuth();
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [invs, setInvs] = useState<Invitacion[]>([]);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('');

  const cargar = async () => {
    const [m, i] = await Promise.all([supabase.from('usuarios').select('id,email,nombre,rol').order('creado_en'), supabase.from('invitaciones').select('id,email').order('creado_en')]);
    setMiembros((m.data ?? []) as Miembro[]); setInvs((i.data ?? []) as Invitacion[]);
  };
  useEffect(() => { cargar(); }, []);

  async function invitar(e: FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    const { error } = await supabase.rpc('invitar_empleado', { p_email: email });
    if (error) { setErr(error.message); return; }
    setMsg(`Listo. Pedile a ${email.trim()} que entre a la app con ese email; queda como empleado automáticamente.`); setEmail(''); cargar();
  }
  async function quitar(id: string) { if (confirm('¿Quitar a esta persona del equipo? Ya no podrá entrar.')) { await supabase.rpc('quitar_empleado', { p_usuario_id: id }); cargar(); } }
  async function revocar(id: string) { await supabase.rpc('revocar_invitacion', { p_id: id }); cargar(); }

  return (
    <div className="card">
      <h2>Equipo</h2>
      <p className="mut">Los empleados pueden vender, usar la caja, ver productos y clientes. No ven la parte contable, las compras, los reportes ni la configuración, y no pueden cambiar precios.</p>
      <table><tbody>
        {miembros.map(m => <tr key={m.id}><td>{m.email ?? m.nombre}{m.id === session?.user.id ? ' (vos)' : ''}</td><td className="mut">{m.rol === 'dueno' ? 'Dueño' : 'Empleado'}</td>
          <td>{m.rol === 'empleado' && <a href="#" onClick={e => { e.preventDefault(); quitar(m.id); }}>quitar</a>}</td></tr>)}
        {invs.map(i => <tr key={i.id}><td>{i.email}</td><td className="mut">Invitación pendiente</td><td><a href="#" onClick={e => { e.preventDefault(); revocar(i.id); }}>cancelar</a></td></tr>)}
      </tbody></table>
      <form onSubmit={invitar}>
        <label>Email del empleado</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="persona@gmail.com" />
        {err && <p className="err">{err}</p>}{msg && <p className="msg">{msg}</p>}
        <button>Invitar empleado</button>
      </form>
    </div>
  );
}
