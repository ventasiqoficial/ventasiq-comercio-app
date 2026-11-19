import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { EstadoPlan } from '../lib/plan';

// Aviso de la prueba gratuita: al empezar (15 días) y cuando faltan 3, 2 y 1 día. Se puede cerrar; vuelve a aparecer otro día.
const K = 'vq_aviso_prueba';
const leer = () => { try { return localStorage.getItem(K); } catch { return null; } };
const guardar = (v: string) => { try { localStorage.setItem(K, v); } catch { /* sin almacenamiento */ } };

export default function AvisoPrueba({ plan, hasta }: { plan: EstadoPlan; hasta: string | null }) {
  const d = plan.diasRestantes;
  const tipo = plan.estado !== 'en_prueba' ? null : d >= 14 ? 'inicio' : d >= 1 && d <= 3 ? 'fin' : null;
  const clave = tipo === 'inicio' ? 'inicio' : `fin-${d}`;
  const [visto, setVisto] = useState<string | null>(leer);
  if (!tipo || visto === clave) return null;
  const fecha = hasta ? new Date(hasta).toLocaleDateString('es-AR') : '';
  const cerrar = () => { guardar(clave); setVisto(clave); };
  return (
    <div role="status" style={{ background: '#FFF3E0', color: '#0E2A33', borderLeft: '4px solid #F57C00', borderRadius: 8, padding: '10px 12px', margin: '0 0 12px', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
      <span>
        {tipo === 'inicio'
          ? <>¡Empezó tu prueba gratuita de 15 días! Podés usar todo el sistema sin cargo hasta el {fecha}. No hace falta cargar una tarjeta ahora. <Link to="/plan">Ver mi plan</Link></>
          : <>Tu prueba gratuita termina pronto: {d === 1 ? 'te queda 1 día' : `te quedan ${d} días`}. Suscribite para seguir usando el sistema sin interrupciones; tus datos quedan guardados. <Link to="/plan">Suscribirme</Link></>}
      </span>
      <button type="button" onClick={cerrar} aria-label="Cerrar aviso" style={{ background: 'transparent', color: '#0E2A33', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: 4 }}>×</button>
    </div>
  );
}
