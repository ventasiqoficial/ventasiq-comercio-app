import { numero } from './csv';

export type ProductoImport = { codigo: string; nombre: string; categoria: string; unidad: string; precio: string; costo: string; stock: string; minimo: string };

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const texto = (v: unknown): string => (v === null || v === undefined ? '' : v instanceof Date ? '' : String(v).trim());

/** Cada campo se reconoce por varios nombres posibles de columna (orden = prioridad). */
const COLUMNAS: Record<keyof ProductoImport, string[]> = {
  codigo: ['codigo de barras', 'codigo', 'cod', 'ean', 'barras', 'sku'],
  nombre: ['nombre', 'producto', 'descripcion', 'articulo', 'detalle'],
  categoria: ['categoria', 'rubro', 'familia'],
  unidad: ['unidad', 'medida'],
  precio: ['precio de venta', 'precio venta', 'precio publico', 'pvp', 'precio'],
  costo: ['costo', 'precio de compra', 'precio compra'],
  stock: ['stock inicial', 'stock actual', 'stock', 'existencia', 'cantidad'],
  minimo: ['stock minimo', 'minimo', 'punto de pedido', 'reposicion'],
};

/** Convierte una tabla de Excel (matriz de celdas) a productos. Busca la fila de encabezados
 *  (la primera que tenga una columna de nombre y otra de precio o código). */
export function matrizAProductos(m: unknown[][]): { productos: ProductoImport[]; sinReconocer: string[] } {
  const reconoce = (h: string, campo: keyof ProductoImport) => COLUMNAS[campo].some(n => h === n || h.includes(n));
  const idx = m.findIndex(r => {
    const h = r.map(c => sinTildes(texto(c)));
    return h.some(x => reconoce(x, 'nombre')) && h.some(x => reconoce(x, 'precio') || reconoce(x, 'codigo'));
  });
  if (idx < 0) return { productos: [], sinReconocer: [] };
  const enc = m[idx].map(c => sinTildes(texto(c)));
  const col: Partial<Record<keyof ProductoImport, number>> = {};
  (Object.keys(COLUMNAS) as (keyof ProductoImport)[]).forEach(campo => {
    // prioridad por orden de nombre; "stock minimo" no debe confundirse con "stock"
    for (const nombre of COLUMNAS[campo]) {
      const i = enc.findIndex((h, k) => (h === nombre || h.includes(nombre)) && !Object.values(col).includes(k) &&
        !(campo === 'stock' && h.includes('minimo')) && !(campo === 'precio' && (h.includes('compra') || h.includes('costo'))));
      if (i >= 0) { col[campo] = i; break; }
    }
  });
  const usadas = new Set(Object.values(col));
  const sinReconocer = m[idx].map(texto).filter((h, i) => h && !usadas.has(i));
  const get = (r: unknown[], campo: keyof ProductoImport) => (col[campo] === undefined ? '' : texto(r[col[campo]!]));
  const num = (s: string) => (s === '' ? '' : String(numero(s)));
  const productos = m.slice(idx + 1)
    .filter(r => r.some(c => texto(c) !== ''))
    .map(r => ({
      codigo: get(r, 'codigo').replace(/\.0$/, ''), nombre: get(r, 'nombre'), categoria: get(r, 'categoria'), unidad: get(r, 'unidad'),
      precio: num(get(r, 'precio')), costo: num(get(r, 'costo')), stock: num(get(r, 'stock')), minimo: num(get(r, 'minimo')),
    }))
    .filter(p => p.nombre !== '');
  return { productos, sinReconocer };
}

export async function leerProductosExcel(file: File) {
  const n = file.name.toLowerCase();
  if (n.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser');
    return matrizAProductos((await readSheet(file)) as unknown[][]);
  }
  if (n.endsWith('.csv')) {
    const { parseCSV } = await import('./csv');
    const filas = parseCSV(await file.text());
    const enc = filas.length ? Object.keys(filas[0]) : [];
    return matrizAProductos([enc, ...filas.map(f => enc.map(h => f[h]))]);
  }
  throw new Error('Subí un archivo Excel (.xlsx). Si tenés uno viejo (.xls), abrilo y guardalo como .xlsx.');
}

/** Modelo de planilla para que el comercio la complete. */
export const PLANILLA_EJEMPLO: string[][] = [
  ['Código', 'Nombre', 'Categoría', 'Precio de venta', 'Costo', 'Stock', 'Stock mínimo'],
  ['7790001000011', 'Yerba 1 kg', 'Almacén', '4500', '3200', '20', '5'],
  ['7790001000028', 'Gaseosa 1,5 L', 'Bebidas', '2800', '1900', '36', '12'],
];
