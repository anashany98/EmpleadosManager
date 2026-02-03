import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { Network, ChevronDown, ChevronRight, Building2, User, ZoomIn, ZoomOut, Maximize2, MousePointer2, FlaskConical, Save, X, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface EmployeeNode {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    jobTitle: string;
    department: string;
    managerId?: string;
    imageUrl?: string;
    name?: string;
}

export default function OrgChart() {
    const [employees, setEmployees] = useState<EmployeeNode[]>([]);
    const [sandboxedEmployees, setSandboxedEmployees] = useState<EmployeeNode[]>([]);
    const [isSandbox, setIsSandbox] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [zoom, setZoom] = useState(0.8);
    const [position, setPosition] = useState({ x: 0, y: 150 });
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchHierarchy();
    }, []);

    const fetchHierarchy = async () => {
        setLoading(true);
        try {
            const res = await api.get('/employees/hierarchy');
            const data = res.data?.data || res.data || res || [];
            setEmployees(Array.isArray(data) ? data : []);
            setSandboxedEmployees(Array.isArray(data) ? JSON.parse(JSON.stringify(data)) : []);
        } catch (error) {
            console.error('Error fetching hierarchy', error);
        } finally {
            setLoading(false);
        }
    };

    const handleZoom = (delta: number) => {
        setZoom(prev => Math.min(Math.max(prev + delta, 0.3), 2));
    };

    const resetView = () => {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setIsDragging(true);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition(prev => ({
            x: prev.x + e.movementX,
            y: prev.y + e.movementY
        }));
    };

    const handleMouseUp = () => setIsDragging(false);

    const toggleSandbox = () => {
        if (isSandbox) {
            setSandboxedEmployees(JSON.parse(JSON.stringify(employees)));
        }
        setIsSandbox(!isSandbox);
        if (!isSandbox) {
            toast.info('Modo Sandbox Activado', {
                description: 'Puedes simular cambios jerárquicos sin afectar los datos reales.'
            });
        }
    };

    const handleReassign = (employeeId: string, newManagerId: string | undefined) => {
        setSandboxedEmployees(prev => prev.map(emp =>
            emp.id === employeeId ? { ...emp, managerId: newManagerId } : emp
        ));
    };

    const saveSandboxChanges = async () => {
        setIsSaving(true);
        try {
            const changedEmployees = sandboxedEmployees.filter(emp => {
                const original = employees.find(e => e.id === emp.id);
                return original?.managerId !== emp.managerId;
            });

            if (changedEmployees.length === 0) {
                toast.success('No hay cambios pendientes');
                setIsSandbox(false);
                return;
            }

            await Promise.all(changedEmployees.map(emp =>
                api.patch(`/employees/${emp.id}`, { managerId: emp.managerId || null })
            ));

            toast.success('Cambios aplicados correctamente', {
                description: `Se han actualizado ${changedEmployees.length} relaciones jerárquicas.`
            });

            await fetchHierarchy();
            setIsSandbox(false);
        } catch (error) {
            toast.error('Error al guardar los cambios');
        } finally {
            setIsSaving(false);
        }
    };

    const buildTree = (source: EmployeeNode[], managerId: string | null = null): any[] => {
        return source
            .filter(emp => {
                if (managerId === null) return !emp.managerId || emp.managerId === '';
                return emp.managerId === managerId;
            })
            .map(emp => ({
                ...emp,
                children: buildTree(source, emp.id)
            }));
    };

    const treeSource = isSandbox ? sandboxedEmployees : employees;
    const tree = buildTree(treeSource, null);

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 space-y-6">
            <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
                <Network size={80} className="text-blue-600 relative animate-bounce" />
            </div>
            <div className="flex flex-col items-center gap-2">
                <p className="text-slate-900 dark:text-white font-black uppercase tracking-widest text-lg">Maquetando Estructura</p>
                <div className="w-48 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="w-full h-full bg-blue-500"
                    />
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-[calc(100vh-160px)] flex flex-col space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className={`w-2 h-2 rounded-full animate-pulse ${isSandbox ? 'bg-amber-500' : 'bg-blue-500'}`} />
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isSandbox ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {isSandbox ? 'Modo Sandbox Activo' : 'Estructura Corporativa'}
                            </span>
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-4">
                            Organigrama
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {isSandbox && (
                        <div className="flex items-center gap-2 mr-2 p-1.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl">
                            <button
                                onClick={saveSandboxChanges}
                                disabled={isSaving}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all active:scale-95"
                            >
                                {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                Guardar Reorganización
                            </button>
                            <button
                                onClick={toggleSandbox}
                                disabled={isSaving}
                                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all"
                                title="Descartar Cambios"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    )}

                    <button
                        onClick={toggleSandbox}
                        className={`
                            px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg
                            ${isSandbox
                                ? 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-105 active:scale-95'}
                        `}
                    >
                        <FlaskConical size={16} />
                        {isSandbox ? 'Salir de Sandbox' : 'Sandbox Reorganización'}
                    </button>

                    <div className="flex items-center gap-3 p-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[24px] border border-white/20 dark:border-slate-800/50 shadow-xl">
                        <button onClick={() => handleZoom(0.1)} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-all"><ZoomIn size={18} /></button>
                        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800" />
                        <button onClick={() => handleZoom(-0.1)} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-all"><ZoomOut size={18} /></button>
                        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800" />
                        <button onClick={resetView} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-all"><Maximize2 size={18} /></button>
                        <div className="px-3 text-xs font-black text-blue-600 tabular-nums">{Math.round(zoom * 100)}%</div>
                    </div>
                </div>
            </div>

            <div
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`
                    flex-1 relative bg-white dark:bg-slate-950 rounded-[40px] border border-slate-100 dark:border-slate-900 shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing
                    ${isDragging ? 'select-none' : ''}
                    ${isSandbox ? 'ring-2 ring-amber-500/20 ring-inset' : ''}
                `}
            >
                {isSandbox && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 px-6 py-2 bg-amber-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-3 border border-amber-400">
                        < FlaskConical size={14} className="animate-bounce" />
                        Modo Simulación: Arrastra responsables para reorganizar
                    </div>
                )}

                {/* Background Grid */}
                <div
                    className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] pointer-events-none transition-transform duration-75"
                    style={{
                        backgroundImage: `radial-gradient(${isSandbox ? '#f59e0b' : '#3b82f6'} 0.5px, transparent 0.5px)`,
                        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
                        transform: `translate(${position.x % (24 * zoom)}px, ${position.y % (24 * zoom)}px)`
                    }}
                />

                <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                        style={{
                            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)'
                        }}
                        className="origin-center"
                    >
                        <div className="flex justify-center min-w-max p-40">
                            {tree.length === 0 ? (
                                <div className="flex flex-col items-center gap-6 grayscale opacity-50">
                                    <div className="w-24 h-24 rounded-[32px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <User size={48} className="text-slate-400" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-slate-500 font-black uppercase tracking-widest">Sin Estructura</p>
                                        <Link to="/employees" className="text-blue-500 font-bold hover:underline text-sm">Configurar Jerarquía</Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-24">
                                    {tree.map(node => (
                                        <TreeNode
                                            key={node.id}
                                            node={node}
                                            isSandbox={isSandbox}
                                            allEmployees={treeSource}
                                            onReassign={handleReassign}
                                            isChanged={isSandbox && employees.find(e => e.id === node.id)?.managerId !== node.managerId}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* Legend & Help Overlay */}
                <div className="absolute bottom-6 left-6 flex flex-col md:flex-row items-start md:items-center gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-3xl border border-white/20 dark:border-slate-800 shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-600" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Dirección</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Responsable</span>
                        </div>
                    </div>
                    <div className="hidden md:block w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-2" />
                    <div className="flex items-center gap-2 text-slate-400">
                        <MousePointer2 size={14} />
                        <span className="text-[10px] font-bold">Arrastra o usa zoom</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TreeNode({ node, isSandbox, allEmployees, onReassign, isChanged }: { node: any, isSandbox: boolean, allEmployees: EmployeeNode[], onReassign: (id: string, mid: string | undefined) => void, isChanged: boolean }) {
    const [isOpen, setIsOpen] = useState(true);
    const [showReassign, setShowReassign] = useState(false);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className="flex flex-col items-center relative">
            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10"
            >
                <div className={`
                    relative p-6 rounded-[32px] border-2 transition-all duration-500 min-w-[280px] group
                    ${isChanged ? 'border-amber-500 ring-4 ring-amber-500/20' : ''}
                    ${hasChildren && isOpen
                        ? 'bg-gradient-to-br from-blue-600 to-indigo-700 border-blue-400 shadow-2xl shadow-blue-500/30'
                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-blue-500/50 shadow-xl'
                    }
                `}>
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            <div className={`
                                w-16 h-16 rounded-[22px] flex items-center justify-center font-black text-2xl shadow-lg transition-transform group-hover:scale-105 duration-500
                                ${hasChildren && isOpen ? 'bg-white text-blue-600' : 'bg-gradient-to-br from-blue-500 to-blue-700 text-white'}
                            `}>
                                {(node.firstName || node.name || '?')[0]?.toUpperCase()}
                            </div>
                            {hasChildren && (
                                <div className={`
                                    absolute -bottom-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black
                                    ${hasChildren && isOpen ? 'bg-indigo-400 text-white' : 'bg-amber-500 text-white shadow-lg'}
                                `}>
                                    {node.children.length}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <Link to={`/employees/${node.id}`} className={`text-lg font-black tracking-tight truncate block hover:underline ${hasChildren && isOpen ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {node.firstName ? `${node.firstName} ${node.lastName || ''}`.trim() : node.name}
                            </Link>
                            <div className={`text-[10px] uppercase font-black tracking-[0.1em] truncate mt-0.5 ${hasChildren && isOpen ? 'text-blue-100/70' : 'text-slate-400'}`}>
                                {node.jobTitle || 'Puesto no asignado'}
                            </div>
                        </div>

                        {isSandbox && (
                            <button
                                onClick={() => setShowReassign(!showReassign)}
                                className={`p-2 rounded-xl transition-all ${hasChildren && isOpen ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-amber-500'}`}
                            >
                                <FlaskConical size={16} />
                            </button>
                        )}
                    </div>

                    <AnimatePresence>
                        {showReassign && isSandbox && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 p-4 max-h-48 overflow-y-auto"
                            >
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-2 px-2">Seleccionar Nuevo Responsable</p>
                                <div className="space-y-1">
                                    <button
                                        onClick={() => { onReassign(node.id, undefined); setShowReassign(false); }}
                                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                        Sin Responsable (Raíz)
                                    </button>
                                    {allEmployees.filter(e => e.id !== node.id).map(e => (
                                        <button
                                            key={e.id}
                                            onClick={() => { onReassign(node.id, e.id); setShowReassign(false); }}
                                            className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            {e.firstName ? `${e.firstName} ${e.lastName || ''}` : e.name}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className={`mt-6 pt-5 border-t flex justify-between items-center ${hasChildren && isOpen ? 'border-white/10' : 'border-slate-50 dark:border-slate-800'}`}>
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${hasChildren && isOpen ? 'bg-white/10 text-white/80' : 'bg-slate-50 dark:bg-slate-800 text-blue-500'}`}>
                                <Building2 size={12} />
                            </div>
                            <span className={`text-[11px] font-black uppercase tracking-tight ${hasChildren && isOpen ? 'text-white/60' : 'text-slate-500'}`}>
                                {node.department || 'Sin Dept.'}
                            </span>
                        </div>

                        {hasChildren && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                                className={`
                                    w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300
                                    ${hasChildren && isOpen
                                        ? 'bg-white/10 text-white hover:bg-white/20'
                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-600 shadow-inner'
                                    }
                                `}
                            >
                                {isOpen ? <ChevronDown size={18} className="stroke-[3]" /> : <ChevronRight size={18} className="stroke-[3]" />}
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>

            <AnimatePresence>
                {isOpen && hasChildren && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-col items-center overflow-visible"
                    >
                        <div className={`w-1 h-12 bg-gradient-to-b ${isChanged ? 'from-amber-500 to-amber-500/20' : 'from-blue-500 to-blue-500/20 dark:from-blue-600 dark:to-blue-900/10'}`} />

                        <div className="relative flex gap-12 pt-0">
                            {node.children.length > 1 && (
                                <div className={`absolute top-0 h-1 bg-gradient-to-r from-transparent via-${isChanged ? 'amber' : 'blue'}-500/30 to-transparent rounded-full`}
                                    style={{
                                        left: `calc(100% / ${node.children.length * 2})`,
                                        right: `calc(100% / ${node.children.length * 2})`
                                    }} />
                            )}

                            {node.children.map((child: any) => (
                                <TreeNode
                                    key={child.id}
                                    node={child}
                                    isSandbox={isSandbox}
                                    allEmployees={allEmployees}
                                    onReassign={onReassign}
                                    isChanged={isSandbox && allEmployees.find(e => e.id === child.id)?.managerId !== child.managerId}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
