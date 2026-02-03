
import { X, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in Leaflet + React
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

interface LocationMapModalProps {
    isOpen: boolean;
    onClose: () => void;
    location: {
        lat: number;
        lng: number;
        address?: string; // Optional nice-to-have
    } | null;
}

export default function LocationMapModal({ isOpen, onClose, location }: LocationMapModalProps) {
    if (!isOpen || !location) return null;

    const position: [number, number] = [location.lat, location.lng];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col h-[600px]">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MapPin className="text-blue-600" size={20} />
                        Ubicación del Fichaje
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Map */}
                <div className="flex-1 relative z-0">
                    <MapContainer center={position} zoom={16} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Marker position={position}>
                            <Popup>
                                <div className="text-center">
                                    <strong>Ubicación Registrada</strong><br />
                                    Lat: {location.lat.toFixed(6)}<br />
                                    Lng: {location.lng.toFixed(6)}
                                </div>
                            </Popup>
                        </Marker>
                    </MapContainer>
                </div>

                {/* Footer info (optional) */}
                <div className="p-4 bg-white dark:bg-slate-900 text-sm text-slate-500 border-t border-slate-100 dark:border-slate-800 text-center">
                    Coordenadas: <span className="font-mono text-slate-700 dark:text-slate-300">{location.lat}, {location.lng}</span>
                </div>
            </div>
        </div>
    );
}
