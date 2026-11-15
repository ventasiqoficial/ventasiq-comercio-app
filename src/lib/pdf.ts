import { jsPDF } from 'jspdf';

export type DocPDF = {
  titulo: 'PRESUPUESTO' | 'REMITO';
  leyenda: string;
  comercio: { nombre: string; cuit: string | null };
  numero: number; fecha: string;
  cliente?: string | null;
  items: { descripcion: string; cantidad: number; precio?: number }[];
  conPrecios: boolean;
  validez?: string; notas?: string | null; referencia?: string | null;
};

const money = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const fechaAR = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

/** Documento NO fiscal. Nunca se presenta como factura. */
export function crearPDF(d: DocPDF): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 15;
  let y = 20;
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.text(d.comercio.nombre, M, y);
  pdf.setFontSize(18); pdf.text(d.titulo, W - M, y, { align: 'right' });
  y += 7; pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
  if (d.comercio.cuit) pdf.text('CUIT: ' + d.comercio.cuit, M, y);
  pdf.text(`N° ${String(d.numero).padStart(8, '0')}`, W - M, y, { align: 'right' });
  y += 5; pdf.text('Fecha: ' + fechaAR(d.fecha), W - M, y, { align: 'right' });
  if (d.validez) { y += 5; pdf.text(d.validez, W - M, y, { align: 'right' }); }
  y += 4; pdf.setDrawColor(14, 42, 51); pdf.setLineWidth(0.5); pdf.line(M, y, W - M, y);
  y += 8;
  if (d.cliente) { pdf.setFont('helvetica', 'bold'); pdf.text('Cliente: ', M, y); pdf.setFont('helvetica', 'normal'); pdf.text(d.cliente, M + 16, y); y += 7; }
  if (d.referencia) { pdf.text('Factura asociada: ' + d.referencia, M, y); y += 7; }

  const cols = d.conPrecios ? { cant: M + 2, desc: M + 22, pu: W - M - 45, sub: W - M - 2 } : { cant: M + 2, desc: M + 22, pu: 0, sub: 0 };
  const cabecera = () => {
    pdf.setFillColor(231, 235, 233); pdf.rect(M, y - 5, W - 2 * M, 8, 'F'); pdf.setFont('helvetica', 'bold');
    pdf.text('Cant.', cols.cant, y); pdf.text('Descripción', cols.desc, y);
    if (d.conPrecios) { pdf.text('P. unit.', cols.pu, y, { align: 'right' }); pdf.text('Subtotal', cols.sub, y, { align: 'right' }); }
    pdf.setFont('helvetica', 'normal'); y += 8;
  };
  cabecera();
  let total = 0;
  for (const it of d.items) {
    const lineas = pdf.splitTextToSize(it.descripcion, d.conPrecios ? 88 : 150) as string[];
    const alto = lineas.length * 5 + 2;
    if (y + alto > 265) { pdf.addPage(); y = 20; cabecera(); }
    pdf.text(String(it.cantidad).replace('.', ','), cols.cant, y); pdf.text(lineas, cols.desc, y);
    if (d.conPrecios && it.precio !== undefined) {
      const sub = it.cantidad * it.precio; total += sub;
      pdf.text(money(it.precio), cols.pu, y, { align: 'right' }); pdf.text(money(sub), cols.sub, y, { align: 'right' });
    }
    y += alto;
    pdf.setDrawColor(211, 218, 216); pdf.setLineWidth(0.2); pdf.line(M, y - 3, W - M, y - 3);
  }
  if (d.conPrecios) {
    if (y > 255) { pdf.addPage(); y = 20; }
    y += 4; pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12);
    pdf.text('TOTAL: ' + money(total), W - M - 2, y, { align: 'right' });
    pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
  }
  if (d.notas) { y += 10; if (y > 265) { pdf.addPage(); y = 20; } pdf.text(pdf.splitTextToSize('Notas: ' + d.notas, W - 2 * M) as string[], M, y); }
  pdf.setFontSize(9); pdf.setTextColor(90, 100, 108);
  pdf.text(d.leyenda, W / 2, 285, { align: 'center' });
  return pdf;
}

export const LEYENDA_PRESUPUESTO = 'DOCUMENTO NO VÁLIDO COMO FACTURA. Presupuesto sujeto a disponibilidad y a la validez indicada.';
export const LEYENDA_REMITO = 'DOCUMENTO NO VÁLIDO COMO FACTURA. Constancia de entrega de mercadería.';
