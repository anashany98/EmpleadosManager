export const PROVINCIAS = [
    'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Baleares', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz',
    'Cantabria', 'Castellón', 'Ciudad Real', 'Córdoba', 'Cuenca', 'Gerona', 'Granada', 'Guadalajara', 'Guipúzcoa', 'Huelva', 'Huesca', 'Jaén',
    'La Coruña', 'La Rioja', 'Las Palmas', 'León', 'Lérida', 'Lugo', 'Madrid', 'Málaga', 'Murcia', 'Navarra', 'Orense', 'Palencia', 'Pontevedra',
    'Salamanca', 'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid', 'Vizcaya',
    'Zamora', 'Zaragoza', 'Ceuta', 'Melilla'
];

export const PAISES = ['España', 'Portugal', 'Francia', 'Italia', 'Alemania', 'Reino Unido', 'Otro'];

export const MUNICIPIOS_MALLORCA = [
    'Alaró', 'Alcúdia', 'Algaida', 'Andratx', 'Ariany', 'Artà', 'Banyalbufar', 'Binissalem', 'Búger', 'Bunyola', 'Calvià', 'Campanet', 'Campos',
    'Capdepera', 'Consell', 'Costitx', 'Deià', 'Escorca', 'Esporles', 'Estellencs', 'Felanitx', 'Fornalutx', 'Inca', 'Lloret de Vistalegre',
    'Lloseta', 'Llubí', 'Llucmajor', 'Manacor', 'Mancor de la Vall', 'Maria de la Salut', 'Marratxí', 'Montuïri', 'Muro', 'Palma', 'Petra',
    'Pollença', 'Porreres', 'Puigpunyent', 'Sa Pobla', 'Sant Joan', 'Sant Llorenç des Cardassar', 'Santa Eugènia', 'Santa Margalida',
    'Santa María del Camí', 'Santanyí', 'Selva', 'Sencelles', 'Ses Salines', 'Sineu', 'Sóller', 'Son Servera', 'Valldemossa', 'Vilafranca de Bonany'
];

export const DEPARTAMENTOS = ['Ventas', 'Administración', 'Producción', 'Logística', 'IT', 'Recursos Humanos', 'Mantenimiento', 'Otros'];
export const PUESTOS = ['Gerente', 'Director', 'Responsable', 'Técnico', 'Operario', 'Auxiliar', 'Administrativo', 'Vendedor', 'Otros'];
export const CATEGORIAS = ['Grupo 1', 'Grupo 2', 'Grupo 3', 'Grupo 4', 'Grupo 5', 'Grupo 6', 'Grupo 7', 'Oficial de 1ª', 'Oficial de 2ª', 'Oficial de 3ª', 'Peón', 'Otros'];
export const TIPOS_CONTRATO = ['Indefinido', 'Temporal', 'Fijo Discontinuo', 'Prácticas', 'Aprendizaje', 'Otros'];
export const CONVENIOS = ['Comercio', 'Textil', 'Madera', 'Hostelería', 'Metal', 'Construcción', 'Oficinas y Despachos', 'Propio de Empresa', 'Otros'];

export const EDIT_TABS = ['personal', 'laboral', 'financiero', 'fechas'];

export const getViewTabs = (isAdmin: boolean, isGlobalAdmin: boolean) => ([
    'resumen',
    'vacaciones',
    'ausencias',
    'cronograma',
    'nominas',
    'control-horario',
    'dietas',
    ...(isAdmin
        ? [
            ...(isGlobalAdmin ? ['generar'] : []),
            'expediente',
            'prl',
            ...(isGlobalAdmin ? ['obras'] : []),
            'activos',
            // Tabs ocultas a petición del usuario (2026-07-23):
            // 'checklists', 'seguridad', 'privacidad'.
            // El render de cada una en EmployeeOperationsSection /
            // EmployeeAdministrationSection se conserva por si se
            // quieren volver a activar — solo no aparecen en la barra.
            'notas-rrhh'
        ]
        : ['prl']),
    'fichajes'
]);

export const getEmployeeTabLabel = (tab: string) => {
    if (tab === 'generar') return 'Generar Doc.';
    if (tab === 'prl') return 'PRL / Formación';
    if (tab === 'ausencias') return 'Ausencias';
    if (tab === 'control-horario') return 'Control Horario';
    if (tab === 'dietas') return 'Dietas';
    return tab.charAt(0).toUpperCase() + tab.slice(1);
};
