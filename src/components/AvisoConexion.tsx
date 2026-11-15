import { descartarFallidas, sincronizar, useConexion } from '../lib/offline';

/** Aviso de modo sin internet y de ventas guardadas que todavía no se enviaron. */
export default function AvisoConexion() {
  const { online, pendientes, fallidas } = useConexion();
  if (online && !pendientes && !fallidas.length) return null;
  const estilo = { background: online ? '#fff7ed' : '#fef3c7', border: '1px solid var(--av)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: '.9rem' } as const;
  return (
    <div style={estilo} role="status">
      {!online && <div><b>Sin internet.</b> Podés seguir vendiendo: las ventas se guardan en este equipo y se envían solas cuando vuelva la conexión.{pendientes ? ` Pendientes de enviar: ${pendientes}.` : ''}</div>}
      {online && pendientes > 0 && <div>Hay {pendientes} {pendientes === 1 ? 'venta guardada' : 'ventas guardadas'} sin enviar. <a href="#" onClick={e => { e.preventDefault(); sincronizar(); }}>Enviar ahora</a></div>}
      {fallidas.length > 0 && <div className="err">
        {fallidas.length} {fallidas.length === 1 ? 'venta no se pudo registrar' : 'ventas no se pudieron registrar'}: {fallidas[0].error}. <a href="#" onClick={e => { e.preventDefault(); descartarFallidas(); }}>Descartar</a>
      </div>}
    </div>
  );
}
