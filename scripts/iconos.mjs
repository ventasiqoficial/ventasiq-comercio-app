// Escribe los íconos PNG de la app (ya decodificados) en public/ antes de compilar.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const iconos = JSON.parse(readFileSync(new URL('./iconos.json', import.meta.url), 'utf8'));
mkdirSync('public', { recursive: true });
for (const [nombre, b64] of Object.entries(iconos)) writeFileSync('public/' + nombre, Buffer.from(b64, 'base64'));
console.log('Íconos escritos:', Object.keys(iconos).join(', '));
