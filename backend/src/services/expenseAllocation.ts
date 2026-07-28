export function splitAmountEvenly(amount: number, count: number): number[] {
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('El importe debe ser mayor que cero');
    }
    if (!Number.isInteger(count) || count < 1) {
        throw new Error('El número de empleados debe ser mayor que cero');
    }

    const totalCents = Math.round(amount * 100);
    const baseCents = Math.floor(totalCents / count);
    const remainder = totalCents - baseCents * count;
    return Array.from({ length: count }, (_, index) =>
        (baseCents + (index < remainder ? 1 : 0)) / 100
    );
}

export function countInclusiveDays(start: string | Date, end: string | Date): number {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startUtc = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
    const endUtc = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
    return Math.max(1, Math.floor((endUtc - startUtc) / 86_400_000) + 1);
}
