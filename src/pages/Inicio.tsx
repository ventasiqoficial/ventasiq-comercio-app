import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { ars, indicadores, peorNivel, queHacerHoy, type Resumen, type Umbral } from '../lib/semaforo';

export default function Inicio() {
  const { comercio } = useAuth();
  const [r, setR] = useState<Resumen | null>(null);
  const [u, setU] = useState<Umbral[]>([]);
  const [err, setErr] = useState('');
  const [pend, setPend] = useState(0);

  useEffect(() => {
    (async () => {
      const [a, b] = await Promise.all([supabase.rpc('resumen_fiscal'), supabase.from('norm_umbrales_alerta').select('tipo,umbral,nivel')]);
      if (a.error) setErr(a.error.message); else setR(a.data as Resumen);
      const d7 = new Date(); d7.setDate(d7.getDate() - 7);
      const p = await supabase.rpc('facturacion_pendiente', { p_desde: d7.toLocaleDateString('en-CA'), p_hasta: new Date().toLocaleDateString('en-CA') });
      setPend(((p.data ?? []) as { falta_electronico: number }[]).reduce((t, x) => t + Number(x.falta_electronico), 0));
      setU(((b.data ?? []) as Umbral[]).map(x => ({ ...x, umbral: Number(x.umbral) })));
    })();
  }, []);

  if (err) return <p className="err">{err}</p>;
  if (!r) return <p className="mut">Calculando…</p>;
  const ind = indicadores(r, u);
  const peor = peorNivel(ind);
  const txt = { ok: 'Todo en orden', aviso: 'Atención', urgente: 'Urgente' }[peor];
  return (
    <>
      <h1>{comercio?.nombre}</h1>
      <div className={`card sem ${peor}`}><span className="dot" />Mi monotributo: {txt}{r.categoria_actual && <span className="mut"> · Categoría {r.categoria_actual}</span>}</div>
      {pend > 0 && <div className="card aviso"><div className="sem"><span className="dot" />Tenés {ars(pend)} cobrados con medios electrónicos sin facturar (últimos 7 días). <Link to="/facturar">Ver qué facturar →</Link></div></div>}
      <h2>Qué hacer hoy</h2>
      <div className="card"><ul>{queHacerHoy(r, ind).map((t, i) => <li key={i}>{t}</li>)}</ul></div>
      <h2>Indicadores</h2>
      {ind.map(i => (
        <div key={i.clave} className={`card ${i.nivel}`}>
          <div className="sem"><span className="dot" />{i.titulo}</div>
          <div className="bar"><i style={{ width: Math.min(100, (i.porcentaje ?? 0) * 100) + '%' }} /></div>
          <div>{ars(i.valor)}{i.tope ? <span className="mut"> de {ars(i.tope)}</span> : null}</div>
          <div className="mut">{i.mensaje}</div>
        </div>
      ))}
      <p className="mut">Los topes se leen de la normativa cargada en el sistema. Son una guía: ante dudas, consultá con un contador.</p>
    </>
  );
}
