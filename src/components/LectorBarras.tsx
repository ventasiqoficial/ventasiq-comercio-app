import { useEffect, useRef, useState } from 'react';

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global { interface Window { BarcodeDetector?: new (o?: { formats: string[] }) => Detector } }

/** Lee códigos de barras con la cámara y sigue leyendo hasta que se cierre.
 *  Usa el lector del navegador si existe (Chrome/Android); si no (iPhone), carga una librería. */
export default function LectorBarras({ alLeer, alCerrar }: { alLeer: (codigo: string) => void; alCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');
  const ultimo = useRef({ c: '', t: 0 });
  const leer = useRef(alLeer); leer.current = alLeer;

  useEffect(() => {
    let vivo = true; let parar: () => void = () => {};
    const entregar = (c: string) => {
      const ahora = Date.now();
      if (!c || (c === ultimo.current.c && ahora - ultimo.current.t < 2000)) return;
      ultimo.current = { c, t: ahora }; leer.current(c);
    };
    (async () => {
      try {
        if (window.BarcodeDetector) {
          const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'] });
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
          if (!vivo || !video.current) { stream.getTracks().forEach(t => t.stop()); return; }
          video.current.srcObject = stream; await video.current.play();
          const id = window.setInterval(async () => {
            if (!video.current || video.current.readyState < 2) return;
            try { const r = await det.detect(video.current); if (r[0]) entregar(r[0].rawValue); } catch { /* cuadro sin código */ }
          }, 300);
          parar = () => { clearInterval(id); stream.getTracks().forEach(t => t.stop()); };
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const lector = new BrowserMultiFormatReader();
          const ctrl = await lector.decodeFromVideoDevice(undefined, video.current!, r => { if (r) entregar(r.getText()); });
          parar = () => ctrl.stop();
        }
      } catch { setErr('No pudimos abrir la cámara. Revisá el permiso del navegador, o usá un lector de código de barras USB (escribe el código y presiona Enter).'); }
    })();
    return () => { vivo = false; parar(); };
  }, []);

  return (
    <div className="card">
      <video ref={video} playsInline muted style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8, background: '#000' }} />
      {err ? <p className="err">{err}</p> : <p className="mut">Apuntá al código de barras. Cada producto leído se suma a la venta.</p>}
      <button type="button" className="sec" onClick={alCerrar}>Cerrar cámara</button>
    </div>
  );
}
