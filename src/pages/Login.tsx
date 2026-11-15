import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');
  const [email, setEmail] = useState(''); const [pass, setPass] = useState('');
  const [err, setErr] = useState(''); const [info, setInfo] = useState(''); const [ocupado, setOcupado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault(); setErr(''); setInfo(''); setOcupado(true);
    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) setErr('Email o contraseña incorrectos.');
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password: pass });
      if (error) setErr(error.message);
      else if (!data.session) setInfo('Te enviamos un email para confirmar la cuenta. Confirmalo y después entrá.');
    }
    setOcupado(false);
  }
  async function conGoogle() {
    setErr(''); setOcupado(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) { setErr('No se pudo ingresar con Google: ' + error.message); setOcupado(false); }
  }
  return (
    <main>
      <img className="logo-login" src="/logo.png" alt="VentasIQ" />
      <h1 style={{ textAlign: 'center' }}>Comercio</h1>
      <p className="mut">Ordená tu monotributo y tus compras sin pagar un contador por cada consulta.</p>
      <div className="card">
        <button type="button" className="sec" style={{ width: '100%', marginTop: 0 }} onClick={conGoogle} disabled={ocupado}>Ingresar con Google</button>
        <p className="mut" style={{ textAlign: 'center', margin: '.6rem 0 0' }}>o con tu email</p>
      </div>
      <form className="card" onSubmit={enviar}>
        <label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        <label>Contraseña</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} required minLength={8} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} />
        {err && <p className="err">{err}</p>}{info && <p className="msg">{info}</p>}
        <button disabled={ocupado}>{modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}</button>{' '}
        <button type="button" className="sec" onClick={() => setModo(modo === 'entrar' ? 'crear' : 'entrar')}>{modo === 'entrar' ? 'Soy nuevo' : 'Ya tengo cuenta'}</button>
      </form>
      <p className="mut">Nunca te pedimos tu clave fiscal.</p>
    </main>
  );
}
