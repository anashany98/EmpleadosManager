import { Server, Socket } from 'socket.io';

export function getEmployeeRoom(employeeId: string | number): string {
    return `employee:${employeeId}`;
}

export function joinEmployeeRoom(socket: Socket, employeeId: string | number): void {
    const room = getEmployeeRoom(employeeId);
    socket.join(room);
}

export function leaveEmployeeRoom(socket: Socket, employeeId: string | number): void {
    const room = getEmployeeRoom(employeeId);
    socket.leave(room);
}

export function broadcastToEmployeeRoom(
    io: Server,
    employeeId: string | number,
    event: string,
    data: any
): void {
    const room = getEmployeeRoom(employeeId);
    io.to(room).emit(event, data);
}

export function getEmployeesInRoom(io: Server, employeeId: string | number): string[] {
    const room = getEmployeeRoom(employeeId);
    return Array.from(io.sockets.adapter.rooms.get(room) || []);
}
