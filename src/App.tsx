import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { configurado } from './lib/supabase';
import Login from './pages/Login';
import Alta from './pages/Alta';
import Inicio from './pages/Inicio';
import Compras from './pages/Compras';
import Cobros from './pages/Cobros';
import Facturacion from './pages/Facturacion';
import Configuracion from './pages/Configuracion';
import Vender from './pages/Vender';
import Caja from './pages/Caja';
import Productos from './pages/Productos';
import Facturar from './pages/Facturar';
import Documentos from './pages/Documentos';
import Contactos from './pages/Contactos';
import MiPlan from './pages/MiPlan';
import Reportes from './pages/Reportes';
import AvisoConexion from './components/AvisoConexion';
import AvisoPrueba from './components/AvisoPrueba';
import { estadoPlan } from './lib/plan';

const CONTABLE = ['/contable', '/facturar', '/cobros', '/facturacion', '/config', '/plan'];


export default function App() {
  const { session, comercio, rol, cargando } = useAuth();
  const { pathname } = useLocation();
  if (!configurado) return <main><div className="card"><h1>Falta configurar</h1><p>Creá el archivo <code>.env.local</code> con <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> (ver README).</p></div></main>;
  if (cargando) return <main><p className="mut">Cargando…</p></main>;
  if (!session) return <Login />;
  if (!comercio) return <Alta />;
  const dueno = rol === 'dueno';
  const contable = CONTABLE.includes(pathname) && dueno;
  // Prueba vencida o suscripción cancelada: solo se puede ver Mi plan (los datos se conservan).
  const planEstado = estadoPlan(comercio.estado_suscripcion, comercio.prueba_hasta);
  const bloqueado = !planEstado.vigente;
  const L = ({ to, t }: { to: string; t: string }) => <NavLink to={to} className={({ isActive }) => (isActive ? 'active' : '')}>{t}</NavLink>;
  return (
    <>
      <header className="top"><div className="in">
        <img src="/logo-claro.png" alt="VentasIQ" />
        {dueno && <div className="seccion"><NavLink to="/vender" className={!contable ? 'on' : ''}>Gestión del comercio</NavLink><NavLink to="/contable" className={contable ? 'on' : ''}>Gestión contable</NavLink></div>}
      </div></header>
      <main>
        <AvisoConexion />
        {dueno && !bloqueado && <AvisoPrueba plan={planEstado} hasta={comercio.prueba_hasta} />}
        {!dueno && bloqueado ? <div className="card"><h1>Suscripción vencida</h1><p>La suscripción de {comercio.nombre} está vencida. Avisale al dueño para que la renueve; tus datos se conservan.</p></div> :
        <Routes>
          {dueno && <Route path="/plan" element={<MiPlan />} />}
          {bloqueado && <Route path="*" element={<Navigate to="/plan" />} />}
          <Route path="/vender" element={<Vender />} />
          <Route path="/caja" element={<Caja />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/documentos" element={<Documentos />} />
          <Route path="/contactos" element={<Contactos />} />
          {dueno && <>
            <Route path="/compras" element={<Compras />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/contable" element={<Inicio />} />
            <Route path="/facturar" element={<Facturar />} />
            <Route path="/cobros" element={<Cobros />} />
            <Route path="/facturacion" element={<Facturacion />} />
            <Route path="/config" element={<Configuracion />} />
          </>}
          <Route path="*" element={<Navigate to="/vender" />} />
        </Routes>}
      </main>
      <nav>
        {contable
          ? <><L to="/contable" t="Resumen" /><L to="/facturar" t="Qué facturar" /><L to="/cobros" t="Cobros" /><L to="/facturacion" t="Importar" /><L to="/config" t="Config." /><L to="/plan" t="Mi plan" /></>
          : <><L to="/vender" t="Vender" /><L to="/caja" t="Caja" /><L to="/productos" t="Productos" />{dueno && <L to="/compras" t="Compras" />}<L to="/documentos" t="Documentos" /><L to="/contactos" t="Contactos" />{dueno && <L to="/reportes" t="Reportes" />}</>}
      </nav>
    </>
  );
}
