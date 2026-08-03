import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api/client";
import { toast } from "sonner";
import { LogIn, Mail, Lock, Loader2, Eye, EyeOff, Users } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

    const validateEmail = (value: string): string | null => {
        if (!value) return "El email es requerido";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/^\d{8}[A-Z]$/.test(value)) {
            return "Email o DNI inválido";
        }
        return null;
    };

    const handleEmailBlur = () => {
        const emailError = validateEmail(email);
        setFieldErrors(prev => ({ ...prev, email: emailError || undefined }));
    };

    const handlePasswordBlur = () => {
        if (!password) {
            setFieldErrors(prev => ({ ...prev, password: "La contraseña es requerida" }));
        } else {
            setFieldErrors(prev => ({ ...prev, password: undefined }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const emailError = validateEmail(email);
        const passwordError = !password ? "La contraseña es requerida" : null;
        setFieldErrors({ email: emailError || undefined, password: passwordError || undefined });

        if (emailError || passwordError) {
            setLoading(false);
            return;
        }

        try {
            const response = await api.post("/auth/login", { identifier: email, password });
            // SECURITY: tokens are set as HttpOnly cookies by the backend
            // response. The frontend never needs to receive or store them.
            login(response.data.user);
            toast.success("¡Bienvenido de nuevo!");
            const redirectTo = sessionStorage.getItem("redirectTo") || location.state?.from?.pathname || "/";
            sessionStorage.removeItem("redirectTo");
            navigate(redirectTo);
        } catch (error: any) {
            console.error(error);
            let msg = "Error al iniciar sesión";
            try {
                const json = JSON.parse(error.message);
                if (json.message) msg = json.message;
            } catch {
                msg = error.message;
            }
            if (msg === "Failed to fetch") msg = "Error de conexión con el servidor. Verifica que está encendido.";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-[10%] w-[40%] h-[40%] bg-amber-200/30 blur-[100px] rounded-full" />
                <div className="absolute bottom-1/4 -right-[10%] w-[40%] h-[40%] bg-rose-200/30 blur-[100px] rounded-full" />
                <div className="absolute top-3/4 left-1/4 w-[30%] h-[30%] bg-orange-200/20 blur-[80px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md relative"
            >
                <div className="bg-white/80 backdrop-blur-xl border border-white/60 p-8 rounded-3xl shadow-2xl shadow-amber-200/50">
                    <div className="flex flex-col items-center mb-8">
                        <div className="bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-4 rounded-2xl shadow-lg shadow-orange-400/30 mb-4">
                            <Users size={32} className="text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Empleados Manager</h1>
                        <p className="text-slate-500 mt-2 font-medium">Panel de Gestión Corporativa</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                        {error && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-600 p-4 rounded-2xl flex items-center gap-3 text-sm font-medium">
                                <div className="bg-rose-100 p-1.5 rounded-lg shrink-0">
                                    <Users size={16} className="text-rose-500" />
                                </div>
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="email" className="text-xs font-bold text-slate-500 uppercase ml-1">Email o DNI</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors">
                                    <Mail size={18} />
                                </span>
                                <input
                                    id="email"
                                    type="text"
                                    placeholder="admin@empresa.com o 12345678Z"
                                    className={`w-full bg-slate-50 border ${fieldErrors.email ? "border-rose-400" : "border-slate-200"} rounded-2xl py-3.5 pl-12 pr-4 text-slate-700 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all placeholder:text-slate-400`}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onBlur={handleEmailBlur}
                                />
                            </div>
                            {fieldErrors.email && (
                                <p className="text-rose-500 text-sm mt-1 ml-1">{fieldErrors.email}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase ml-1">Contraseña</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors">
                                    <Lock size={18} />
                                </span>
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    className={`w-full bg-slate-50 border ${fieldErrors.password ? "border-rose-400" : "border-slate-200"} rounded-2xl py-3.5 pl-12 pr-10 text-slate-700 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all placeholder:text-slate-400`}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onBlur={handlePasswordBlur}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {fieldErrors.password && (
                                <p className="text-rose-500 text-sm mt-1 ml-1">{fieldErrors.password}</p>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => navigate("/request-reset")}
                                className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors"
                            >
                                ¿Activar cuenta o olvidaste tu contraseña?
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 disabled:opacity-50 text-white py-3.5 rounded-2xl font-bold shadow-xl shadow-orange-400/30 transition-all flex items-center justify-center gap-2 mt-2"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <LogIn size={20} />
                                    <span>Entrar al Sistema</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center border-t border-slate-200/50 pt-6">
                        <p className="text-slate-400 text-[10px] font-medium uppercase tracking-widest">
                            Acceso Restringido • © 2025 Empleados Manager
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
