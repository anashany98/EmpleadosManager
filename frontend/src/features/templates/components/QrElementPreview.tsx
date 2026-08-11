import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { CanvasElement } from './types';

const PREVIEW_PAYLOAD = JSON.stringify({
    t: 'DOCUMENTO',
    eid: 'trabajador',
    d: 'vista-previa'
});

export function QrElementPreview({ element }: { element: CanvasElement }) {
    const [src, setSrc] = useState('');

    useEffect(() => {
        let active = true;
        const value = element.qrDataSource === 'document'
            ? PREVIEW_PAYLOAD
            : element.qrValue || PREVIEW_PAYLOAD;
        void QRCode.toDataURL(value, {
            errorCorrectionLevel: 'M',
            margin: 1,
            color: {
                dark: element.color || '#172033',
                light: element.backgroundColor || '#ffffff'
            }
        }).then((url) => {
            if (active) setSrc(url);
        });
        return () => {
            active = false;
        };
    }, [element.qrDataSource, element.qrValue, element.color, element.backgroundColor]);

    return src
        ? <img src={src} alt="QR para archivar el documento" className="h-full w-full object-contain" draggable={false} />
        : <div className="h-full w-full animate-pulse bg-slate-100" aria-label="Generando QR" />;
}
