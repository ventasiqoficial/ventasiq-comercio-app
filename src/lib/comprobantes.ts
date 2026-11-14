// Códigos de comprobante de ARCA que el comercio ve con nombre, no como número suelto
export const TIPOS_EMITIDOS: [string, string][] = [['11', 'Factura C'], ['13', 'Nota de crédito C'], ['12', 'Nota de débito C']];
export const TIPOS_COMPRA: [string, string][] = [
  ['001', 'Factura A'], ['006', 'Factura B'], ['011', 'Factura C'], ['051', 'Factura M'],
  ['003', 'Nota de crédito A'], ['008', 'Nota de crédito B'], ['013', 'Nota de crédito C'],
  ['002', 'Nota de débito A'], ['007', 'Nota de débito B'], ['012', 'Nota de débito C'],
];
export const CODIGOS_NC = ['003', '008', '013', '053', '203', '208', '213'];
