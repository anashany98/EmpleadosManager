
import React, { useState } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Loader2, CheckCircle2 } from 'lucide-react';

export default function RequestReset() {
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [debugLink, setDebugLink] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setDebugLink('');
        try {
            const res = await api.post('/auth/request-password-reset', { identifier });
            if (res.success) {
                setSuccess(true);
                toast.success('Solicitud enviada correctamente');
                // FOR DEMO PURPOSES ONLY: Show link
                if (res.data?.debugLink) {
                    setDebugLink(res.data.debugLink);
                }
            }
        } catch (error: any) {
            toast.error(error.message || 'Error al procesar la solicitud');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 w-full max-w-md p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 text-center animate-in fade-in zoom-in duration-300">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 dark:text-green-400">
                        <CheckCircle2 size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">¡Solicitud recibida!</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">
                        Si tus datos coinciden con nuestros registros, recibirás un correo con las instrucciones para restablecer tu contraseña.
                    </p>

                    {debugLink && (
                        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg text-left text-sm break-all">
                            <p className="font-bold text-yellow-800 dark:text-yellow-500 mb-1">MODO DEMO - Enlace generado:</p>
                            <a href={debugLink} className="text-blue-600 underline">{debugLink}</a>
                        </div>
                    )}

                    <Link to="/login" className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors block">
                        Volver al inicio de sesión
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
                <Link to="/login" className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mb-6 transition-colors">
                    <ArrowLeft size={16} /> Volver
                </Link>

                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Recuperar Acceso</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Introduce tu DNI o correo electrónico para recibir instrucciones.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            DNI o Email
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="Ej: 12345678A o nombre@email.com"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 className="animate-spin" size={20} />}
                        {loading ? 'Enviando...' : 'Enviar Instrucciones'}
                    </button>
                </form>
            </div>
        </div>
    );
}
