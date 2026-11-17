import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

type DetectorQR = { detect: (fuente: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type Pista = MediaStreamTrack & { getCapabilities?: () => Record<string, unknown>; applyConstraints: (c: unknown) => Promise<void> };

/**
 * Abre la cámara y lee códigos QR (facturas y tickets de ARCA, que son QR densos).
 * - Pide alta resolución y enfoque continuo: con la resolución por defecto el QR no se llega a leer.
 * - Usa el lector nativo del celular cuando existe (BarcodeDetector) y, si no, jsQR.
 * - `alLeer` devuelve true si el texto sirvió (se cierra); false si no sirvió (sigue escaneando).
 */
export default function Escaner({ alLeer, alCerrar }: { alLeer: (texto: string) => boolean | void; alCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const pista = useRef<Pista | null>(null);
  const [err, setErr] = useState('');
  const [linterna, setLinterna] = useState<boolean | null>(null); // null = no disponible
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null; let vivo = true; let timer = 0; let ocupado = false; let ultimoRechazado = '';
    (async () => {
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (!vivo || !video.current) { stream.getTracks().forEach(t => t.stop()); return; }
        const t = stream.getVideoTracks()[0] as Pista; pista.current = t;
        try {
          const cap = t.getCapabilities?.() ?? {};
          const modos = (cap.focusMode as string[] | undefined) ?? [];
          if (modos.includes('continuous')) await t.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          if ('torch' in cap) setLinterna(false);
        } catch { /* no todos los celulares permiten ajustar el enfoque */ }
        video.current.srcObject = stream; await video.current.play();

        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorQR }).BarcodeDetector;
        let nativo: DetectorQR | null = null;
        try { if (BD) nativo = new BD({ formats: ['qr_code'] }); } catch { nativo = null; }
        const lienzo = document.createElement('canvas'); const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;

        const leerFotograma = async (v: HTMLVideoElement): Promise<string | null> => {
          if (nativo) {
            try { const r = await nativo.detect(v); if (r.length && r[0].rawValue) return r[0].rawValue; } catch { /* sigue con jsQR */ }
          }
          const k = Math.min(1, 1600 / v.videoWidth);
          lienzo.width = Math.round(v.videoWidth * k); lienzo.height = Math.round(v.videoHeight * k);
          ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height);
          const d = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
          return jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
        };

        const tick = async () => {
          const v = video.current;
          if (!vivo || !v) return;
          if (v.videoWidth && !ocupado) {
            ocupado = true;
            try {
              const texto = await leerFotograma(v);
              if (texto && texto !== ultimoRechazado) {
                const ok = alLeer(texto);
                if (ok === false) { ultimoRechazado = texto; setAviso('Leímos un código, pero no es el de una factura. Probá con el QR de la factura o ticket.'); }
                else { vivo = false; return; }
              }
            } finally { ocupado = false; }
          }
          if (vivo) timer = window.setTimeout(tick, 120);
        };
        tick();
      } catch { setErr('No pudimos abrir la cámara. Revisá el permiso del navegador, o subí una foto o el PDF de la factura.'); }
    })();
    return () => { vivo = false; clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  async function alternarLinterna() {
    try { await pista.current?.applyConstraints({ advanced: [{ torch: !linterna }] }); setLinterna(!linterna); } catch { setLinterna(null); }
  }

  return (
    <div className="card">
      <video ref={video} playsInline muted style={{ width: '100%', borderRadius: 8, background: '#000' }} />
      {err ? <p className="err">{err}</p> : <p className="mut">Apuntá la cámara al código QR de la factura o ticket. Con buena luz y a unos 15–20 cm, quieto un segundo. Los QR de ARCA son densos: si no lo lee, alejalo un poco.</p>}
      {aviso && <p className="err">{aviso}</p>}
      {linterna !== null && <button type="button" className="sec" onClick={alternarLinterna}>{linterna ? 'Apagar linterna' : 'Prender linterna'}</button>}{' '}
      <button type="button" className="sec" onClick={alCerrar}>Cancelar</button>
    </div>
  );
}
