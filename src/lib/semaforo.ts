export type Nivel = 'ok' | 'aviso' | 'urgente';
export type Umbral = { tipo: string; umbral: number; nivel: 'aviso' | 'urgente' };

export type Resumen = {
  categoria_actual: string | null;
  categoria_correspondiente: string | null;
  excluido_por_parametros: boolean;
  facturado_12m: number;
  tope_categoria_actual: number | null;
  compras_gastos_12m: number;
  limite_compras_gastos: number | null;
  cobros_electronicos_venta_12m: number;
  brecha_cobros_vs_facturado: number;
  cobros_sin_clasificar_cantidad: number;
  cobros_sin_clasificar_importe: number;
  precio_unitario_max: number | null;
  precio_producto_mayor: number | null;
  energia_kw_anual: number | null; energia_max_categoria: number | null;
  alquiler_anual: number | null; alquiler_max_categoria: number | null;
};

export type Indicador = {
  clave: string; titulo: string; valor: number; tope: number | null;
  porcentaje: number | null; nivel: Nivel; mensaje: string;
};

/** Nivel según los umbrales cargados en norm_umbrales_alerta (ninguno hardcodeado). */
export function nivelPara(ratio: number | null, tipo: string, umbrales: Umbral[]): Nivel {
  if (ratio === null || !isFinite(ratio)) return 'ok';
  let nivel: Nivel = 'ok';
  for (const u of umbrales.filter(x => x.tipo === tipo).sort((a, b) => a.umbral - b.umbral)) {
    if (ratio >= u.umbral) nivel = u.nivel === 'urgente' ? 'urgente' : (nivel === 'urgente' ? nivel : 'aviso');
  }
  return nivel;
}

const ars = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const pct = (r: number) => Math.round(r * 100) + '%';

export function indicadores(r: Resumen, umbrales: Umbral[]): Indicador[] {
  const out: Indicador[] = [];
  const mk = (clave: string, titulo: string, valor: number, tope: number | null, tipo: string, msj: (p: string) => string) => {
    const ratio = tope && tope > 0 ? valor / tope : null;
    const nivel = nivelPara(ratio, tipo, umbrales);
    out.push({ clave, titulo, valor, tope, porcentaje: ratio === null ? null : ratio, nivel, mensaje: ratio === null ? 'Falta cargar la categoría para calcular.' : msj(pct(ratio)) });
  };
  mk('facturacion', 'Facturación de 12 meses', r.facturado_12m, r.tope_categoria_actual, 'facturacion_vs_tope_categoria',
    p => `Usaste el ${p} del tope de tu categoría ${r.categoria_actual ?? ''}.`);
  mk('compras', 'Compras + gastos de 12 meses', r.compras_gastos_12m, r.limite_compras_gastos, 'compras_gastos_vs_limite_80',
    p => `Llevás el ${p} del límite que ARCA mira para excluirte (80% del tope más alto).`);
  mk('cobros', 'Cobros electrónicos vs. facturado', r.cobros_electronicos_venta_12m, r.tope_categoria_actual, 'cobros_electronicos_vs_tope',
    p => `Tus cobros electrónicos equivalen al ${p} del tope. ARCA los cruza con lo que facturás.`);
  if (r.precio_unitario_max && r.precio_producto_mayor !== null)
    mk('precio', 'Producto más caro', r.precio_producto_mayor, r.precio_unitario_max, 'precio_unitario_vs_maximo',
      p => `Tu producto más caro llega al ${p} del precio unitario máximo permitido.`);
  return out;
}

export function peorNivel(i: Indicador[]): Nivel {
  return i.some(x => x.nivel === 'urgente') ? 'urgente' : i.some(x => x.nivel === 'aviso') ? 'aviso' : 'ok';
}

/** Lista corta de "qué hacer hoy", en lenguaje simple. */
export function queHacerHoy(r: Resumen, ind: Indicador[]): string[] {
  const t: string[] = [];
  if (!r.categoria_actual) t.push('Cargá tu categoría de monotributo en Configuración.');
  if (r.excluido_por_parametros) t.push('Algún parámetro (ingresos, superficie, energía o alquiler) supera el máximo del régimen. Revisá los valores vigentes en ARCA y decidí cómo seguir.');
  if (r.cobros_sin_clasificar_cantidad > 0)
    t.push(`Tenés ${r.cobros_sin_clasificar_cantidad} cobros/pagos electrónicos sin clasificar (${ars(r.cobros_sin_clasificar_importe)}).`);
  if (r.categoria_actual && r.categoria_correspondiente && r.categoria_correspondiente > r.categoria_actual)
    t.push(`Por lo facturado te correspondería la categoría ${r.categoria_correspondiente} (hoy estás en ${r.categoria_actual}).`);
  for (const i of ind) if (i.nivel !== 'ok') t.push(i.mensaje);
  if (!t.length) t.push('Todo en orden. Recordá cargar las facturas de compra del mes.');
  return t;
}
export { ars, pct };
