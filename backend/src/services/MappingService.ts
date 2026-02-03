interface MappingRules {
    [targetField: string]: string; // "neto": "Columna K", "employeeName": "Columna A"
}

export class MappingService {
    /**
     * Aplica las reglas de mapeo a una lista de filas crudas.
     * Retorna objetos listos para guardar en PayrollRow.
     */
    static applyMapping(rawRows: any[], mappingRules: MappingRules, batchId: string) {
        return rawRows.map(row => {
            // Helper para leer valor según la columna mapeada
            const getValue = (targetField: string) => {
                const sourceCol = mappingRules[targetField];
                if (!sourceCol) return null;
                return row[sourceCol];
            };

            // Helper para limpiar numéricos (ej: "1.200,50" -> 1200.50)
            const parseMoney = (val: any): number => {
                if (!val) return 0;
                if (typeof val === 'number') return val;
                // Reemplazar puntos de miles por nada, y comas decimales por puntos (asumiendo formato ES)
                // Ojo: Esto depende del locale del perfil. Simplificamos para ES.
                let str = String(val).replace(/\./g, '').replace(',', '.');
                return parseFloat(str) || 0;
            };

            return {
                batchId,
                rawEmployeeName: getValue('employeeName') || 'N/A',
                employeeId: getValue('employeeId'), // DNI si viene en el excel

                bruto: parseMoney(getValue('bruto')),
                ssEmpresa: parseMoney(getValue('ssEmpresa')),
                ssTrabajador: parseMoney(getValue('ssTrabajador')),
                irpf: parseMoney(getValue('irpf')),
                neto: parseMoney(getValue('neto')),

                extraData: row, // Guardamos todo por si acaso
                status: 'PENDING'
            };
        });
    }
}
