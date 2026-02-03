
export const HOLIDAYS = [
    // 2024
    '2024-01-01', // Año Nuevo
    '2024-03-01', // Día Baleares
    '2024-03-28', // Jueves Santo
    '2024-03-29', // Viernes Santo
    '2024-04-01', // Lunes de Pascua
    '2024-05-01', // Fiesta del Trabajo
    '2024-06-24', // San Juan (Palma)
    '2024-08-15', // Asunción
    '2024-10-12', // Fiesta Nacional
    '2024-11-01', // Todos los Santos
    '2024-12-06', // Constitución
    '2024-12-25', // Navidad
    '2024-12-26', // San Esteban

    // 2025
    '2025-01-01', // Año Nuevo
    '2025-01-06', // Reyes
    '2025-01-17', // San Antonio (Mallorca local)
    '2025-04-17', // Jueves Santo
    '2025-04-18', // Viernes Santo
    '2025-04-21', // Lunes de Pascua
    '2025-05-01', // Trabajo
    '2025-08-15', // Asunción
    '2025-12-08', // Inmaculada
    '2025-12-25', // Navidad
    '2025-12-26', // San Esteban

    // 2026
    '2026-01-01', // Año Nuevo
    '2026-01-06', // Reyes
    '2026-03-01', // Día Baleares
    '2026-04-02', // Jueves Santo
    '2026-04-03', // Viernes Santo
    '2026-04-06', // Lunes de Pascua
    '2026-05-01', // Fiesta del Trabajo
    '2026-06-24', // San Juan (Palma)
    '2026-08-15', // Asunción
    '2026-10-12', // Fiesta Nacional
    '2026-11-01', // Todos los Santos
    '2026-12-06', // Constitución
    '2026-12-08', // Inmaculada
    '2026-12-25', // Navidad
    '2026-12-26', // San Esteban
];


export const HolidayService = {
    isHoliday: (date: Date) => {
        // Use local date parts to ensure we check the day represented by the date object locally
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        return HOLIDAYS.includes(dateStr);
    },

    // Calcula días laborables reales (sin Fines de Semana ni Festivos)
    getBusinessDaysCount: (start: Date, end: Date) => {
        let count = 0;

        // Normalize to local date by adding 12h to handle potential timezone shifts of input midnights
        let current = new Date(start);
        current.setTime(current.getTime() + 12 * 60 * 60 * 1000);
        current.setHours(0, 0, 0, 0);

        const targetEnd = new Date(end);
        targetEnd.setTime(targetEnd.getTime() + 12 * 60 * 60 * 1000);
        targetEnd.setHours(0, 0, 0, 0);

        while (current <= targetEnd) {
            const dayOfWeek = current.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6 && !HolidayService.isHoliday(current)) {
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        return count;
    }
};
