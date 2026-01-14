
import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!token) {
            toast.error('Enlace inválido o incompleto');
            navigate('/login');
        }
    }, [token, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/auth/reset-password', { token, newPassword: password });
            if (res.success) {
                setSuccess(true);
                toast.success('Contraseña actualizada correctamente');
                setTimeout(() => navigate('/login'), 3000);
            }
        } catch (error: any) {
            toast.error(error.message || 'Error al restablecer la contraseña');
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
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">¡Contraseña Actualizada!</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">
                        Tu contraseña se ha cambiado correctamente. Redirigiendo al inicio de sesión...
                    </p>
                    <Link to="/login" className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors block shadow-lg shadow-blue-500/20">
                        Ir al Login ahora
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Nueva Contraseña</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Introduce tu nueva contraseña para acceder.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Nueva Contraseña
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="Mínimo 6 caracteres"
                                required
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Confirmar Contraseña
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="Repite la contraseña"
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
                        {loading ? 'Guardar Contraseña' : 'Establecer Contraseña'}
                    </button>
                </form>
            </div>
        </div>
    );
}
