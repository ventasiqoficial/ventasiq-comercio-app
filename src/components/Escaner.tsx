import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/** Abre la cámara y devuelve el texto del primer QR que lee. */
export default function Escaner({ alLeer, alCerrar }: { alLeer: (texto: string) => void; alCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null; let vivo = true; let raf = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        if (!vivo || !video.current) return;
        video.current.srcObject = stream; await video.current.play();
        const c = document.createElement('canvas'); const ctx = c.getContext('2d', { willReadFrequently: true })!;
        const tick = () => {
          const v = video.current;
          if (!vivo || !v) return;
          if (v.videoWidth) {
            c.width = v.videoWidth; c.height = v.videoHeight; ctx.drawImage(v, 0, 0);
            const d = ctx.getImageData(0, 0, c.width, c.height);
            const r = jsQR(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' });
            if (r?.data) { alLeer(r.data); return; }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch { setErr('No pudimos abrir la cámara. Revisá el permiso del navegador, o subí una foto o el PDF de la factura.'); }
    })();
    return () => { vivo = false; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  return (
    <div className="card">
      <video ref={video} playsInline muted style={{ width: '100%', borderRadius: 8, background: '#000' }} />
      {err ? <p className="err">{err}</p> : <p className="mut">Apuntá la cámara al código QR de la factura.</p>}
      <button type="button" className="sec" onClick={alCerrar}>Cancelar</button>
    </div>
  );
}
