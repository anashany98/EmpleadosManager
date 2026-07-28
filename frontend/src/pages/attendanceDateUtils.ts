export function buildLocalDayRange(date: string) {
    const [year, month, day] = date.split('-').map(Number);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
}

export function buildLocalTimestamp(date: string, time: string) {
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
}
