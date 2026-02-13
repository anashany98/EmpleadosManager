
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { Car, Truck, Plus, Check, Trash2, PenSquare, AlertTriangle, Calendar, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Vehicle {
    id: string;
    plate: string;
    make: string;
    model: string;
    year?: number;
    vin?: string;
    type: 'CAR' | 'VAN' | 'MOTORCYCLE' | 'TRUCK';
    status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
    currentMileage: number;
    nextITVDate?: string;
    lastMaintenanceDate?: string;
    nextMaintenanceKm?: number;
    employee?: { id: string; firstName: string; lastName: string };
    employeeId?: string;
    image?: string;
}

export function VehicleManager() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const queryClient = useQueryClient();

    const { data: vehicles = [], isLoading } = useQuery<Vehicle[]>({
        queryKey: ['vehicles'],
        queryFn: async () => {
            const res = await api.get('/vehicles');
            return res.data?.data || res.data || [];
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => api.delete(`/vehicles/${id}`),
        onSuccess: () => {
            toast.success('Vehículo eliminado');
            queryClient.invalidateQueries({ queryKey: ['vehicles'] });
        },
        onError: () => toast.error('Error al eliminar vehículo')
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Flota de Vehículos</h2>
                <button
                    onClick={() => { setEditingVehicle(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                    <Plus className="w-4 h-4" />
                    Añadir Vehículo
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {vehicles.map((vehicle) => (
                        <div key={vehicle.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all relative group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
                                    <Car className="w-6 h-6" />
                                </div>
                                <div className={`px-2 py-1 rounded-lg text-xs font-black uppercase ${vehicle.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                                    vehicle.status === 'MAINTENANCE' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    {vehicle.status === 'ACTIVE' ? 'Activo' : vehicle.status === 'MAINTENANCE' ? 'Mantenimiento' : 'Inactivo'}
                                </div>
                            </div>

                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">{vehicle.make} {vehicle.model}</h3>
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded inline-block">{vehicle.plate}</p>

                            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-slate-400" />
                                    <span>{vehicle.currentMileage.toLocaleString()} km</span>
                                </div>
                                {vehicle.nextITVDate && (
                                    <div className={`flex items-center gap-2 ${new Date(vehicle.nextITVDate) < new Date() ? 'text-red-500 font-bold' : ''}`}>
                                        <Calendar className="w-4 h-4" />
                                        <span>ITV: {new Date(vehicle.nextITVDate).toLocaleDateString()}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">👤</span>
                                    <span>{vehicle.employee ? `${vehicle.employee.firstName} ${vehicle.employee.lastName}` : 'Sin asignar'}</span>
                                </div>
                            </div>

                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                <button
                                    onClick={() => { setEditingVehicle(vehicle); setIsModalOpen(true); }}
                                    className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:text-indigo-600"
                                >
                                    <PenSquare className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm('¿Seguro que quieres eliminar este vehículo?')) deleteMutation.mutate(vehicle.id);
                                    }}
                                    className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:text-red-600"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <AnimatePresence>
                {isModalOpen && (
                    <VehicleModal
                        vehicle={editingVehicle}
                        onClose={() => setIsModalOpen(false)}
                        onSuccess={() => {
                            setIsModalOpen(false);
                            queryClient.invalidateQueries({ queryKey: ['vehicles'] });
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function VehicleModal({ vehicle, onClose, onSuccess }: { vehicle: Vehicle | null, onClose: () => void, onSuccess: () => void }) {
    const isEdit = !!vehicle;
    const [formData, setFormData] = useState<Partial<Vehicle>>(vehicle || {
        plate: '', make: '', model: '', type: 'CAR', status: 'ACTIVE', currentMileage: 0
    });

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            if (isEdit) return api.put(`/vehicles/${vehicle.id}`, data);
            return api.post('/vehicles', data);
        },
        onSuccess: () => {
            toast.success(`Vehículo ${isEdit ? 'actualizado' : 'creado'}`);
            onSuccess();
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Error al guardar')
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            const res = await api.get('/employees');
            return res.data?.data || res.data || [];
        }
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6">
                    {isEdit ? 'Editar Vehículo' : 'Nuevo Vehículo'}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 space-y-2">
                    <div className="col-span-1">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Matrícula</label>
                        <input
                            type="text"
                            value={formData.plate}
                            onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl"
                            placeholder="1234 ABC"
                        />
                    </div>
                    <div className="col-span-1">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Tipo</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                            className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl"
                        >
                            <option value="CAR">Coche</option>
                            <option value="VAN">Furgoneta</option>
                            <option value="MOTORCYCLE">Moto</option>
                            <option value="TRUCK">Camión</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Marca</label>
                        <input type="text" value={formData.make} onChange={e => setFormData({ ...formData, make: e.target.value })} className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl" />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Modelo</label>
                        <input type="text" value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl" />
                    </div>

                    <div>
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Kilometraje Actual</label>
                        <input type="number" value={formData.currentMileage} onChange={e => setFormData({ ...formData, currentMileage: Number(e.target.value) })} className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl" />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Próxima ITV</label>
                        <input type="date" value={formData.nextITVDate ? new Date(formData.nextITVDate).toISOString().split('T')[0] : ''} onChange={e => setFormData({ ...formData, nextITVDate: e.target.value })} className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl" />
                    </div>

                    <div className="col-span-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Conductor Asignado</label>
                        <select
                            value={formData.employeeId || ''}
                            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value || undefined })}
                            className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl"
                        >
                            <option value="">-- Sin asignar --</option>
                            {employees.map((emp: any) => (
                                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                            ))}
                        </select>
                    </div>

                    <div className="col-span-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Estado</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                            className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl"
                        >
                            <option value="ACTIVE">Activo</option>
                            <option value="MAINTENANCE">En Mantenimiento</option>
                            <option value="INACTIVE">Inactivo (Histórico)</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-4 mt-8">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-200">
                        Cancelar
                    </button>
                    <button onClick={() => mutation.mutate(formData)} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                        {mutation.isPending ? 'Guardando...' : 'Guardar Vehículo'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
