import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting data population...');

    const employees = await prisma.employee.findMany();
    const companies = await prisma.company.findMany();
    const users = await prisma.user.findMany();

    if (employees.length === 0) {
        console.log('No employees found to populate.');
        return;
    }

    const adminUser = users.find(u => u.role === 'ADMIN') || users[0];
    const company = companies[0];

    // 1. Create some Inventory Items if not exist
    const inventoryItems = [
        { name: 'MacBook Pro 14', category: 'TECH', quantity: 5, minQuantity: 2 },
        { name: 'iPhone 15', category: 'TECH', quantity: 8, minQuantity: 3 },
        { name: 'Casco de Seguridad', category: 'EPI', quantity: 15, minQuantity: 5 },
        { name: 'Botas de Seguridad', category: 'EPI', quantity: 12, minQuantity: 4 },
        { name: 'Taladro Percutor', category: 'TOOLS', quantity: 3, minQuantity: 1 },
    ];

    for (const item of inventoryItems) {
        await prisma.inventoryItem.upsert({
            where: { name_size: { name: item.name, size: '' } },
            update: {},
            create: {
                ...item,
                size: ''
            }
        });
    }

    const dbItems = await prisma.inventoryItem.findMany();

    // 1.5 Add some random movements for the inventory items
    console.log('Adding inventory movements...');
    for (const item of dbItems) {
        await prisma.inventoryMovement.create({
            data: {
                inventoryItemId: item.id,
                type: 'ENTRY',
                quantity: 10,
                userId: adminUser?.id || 'system',
                notes: 'Carga inicial de stock para inventario.'
            }
        });
    }

    // 1.6 Create a dummy Payroll Batch
    console.log('Creating mock payroll batch...');
    const batch = await prisma.payrollImportBatch.create({
        data: {
            sourceFilename: 'Nominas_Diciembre_2025.xlsx',
            month: 12,
            year: 2025,
            status: 'COMPLETED',
            createdById: adminUser?.id || 'system',
            notes: 'Importación mensual de nóminas'
        }
    });

    // 2. Populate for each employee
    for (const emp of employees) {
        const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Empleado Sin Nombre';
        console.log(`Populating data for: ${fullName}`);

        // Update DNI/License expiration to trigger alerts for some
        const randomDays = Math.floor(Math.random() * 60) - 10;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + randomDays);

        await prisma.employee.update({
            where: { id: emp.id },
            data: {
                dniExpiration: Math.random() > 0.5 ? expiryDate : emp.dniExpiration,
                drivingLicenseExpiration: Math.random() > 0.7 ? new Date(expiryDate.getTime() + 10000000) : emp.drivingLicenseExpiration
            }
        });

        // Add Vacations
        await prisma.vacation.create({
            data: {
                employeeId: emp.id,
                startDate: new Date('2025-11-01'),
                endDate: new Date('2025-11-10'),
                type: 'VACATION',
                status: 'APPROVED',
                reason: 'Vacaciones de invierno'
            }
        });

        if (Math.random() > 0.7) {
            const today = new Date();
            const endDate = new Date();
            endDate.setDate(today.getDate() + 5);
            await prisma.vacation.create({
                data: {
                    employeeId: emp.id,
                    startDate: today,
                    endDate: endDate,
                    type: 'VACATION',
                    status: 'APPROVED',
                    reason: 'Viaje personal'
                }
            });
        }

        // Add Assets
        const techItem = dbItems.find(i => i.category === 'TECH');
        if (techItem) {
            await prisma.asset.create({
                data: {
                    employeeId: emp.id,
                    category: 'TECH',
                    name: techItem.name,
                    serialNumber: `SN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                    status: 'ASSIGNED',
                    assignedDate: new Date(),
                    inventoryItemId: techItem.id
                }
            });
        }

        // Add Payroll Row
        await prisma.payrollRow.create({
            data: {
                batchId: batch.id,
                employeeId: emp.id,
                rawEmployeeName: fullName,
                bruto: 2500 + Math.random() * 500,
                neto: 1800 + Math.random() * 400,
                irpf: 400 + Math.random() * 100,
                ssEmpresa: 800 + Math.random() * 100,
                ssTrabajador: 150 + Math.random() * 50,
                status: 'COMPLETED'
            }
        });

        // Add some Documents
        const docCategories = ['CONTRACT', 'PRL', 'PAYROLL'];
        for (const cat of docCategories) {
            await prisma.document.create({
                data: {
                    employeeId: emp.id,
                    name: `${cat}_${emp.lastName || 'Doc'}.pdf`,
                    category: cat,
                    fileUrl: `/uploads/documents/placeholder.pdf`,
                    uploadDate: new Date()
                }
            });
        }

        // Add some random activity logs
        const actions = ['ACCESO_RECIBO', 'DESCARGA_DOCUMENTO', 'SOLICITUD_VACACIONES'];
        for (const action of actions) {
            if (Math.random() > 0.5) {
                await prisma.auditLog.create({
                    data: {
                        userId: adminUser?.id || 'system',
                        action,
                        entity: 'Employee',
                        entityId: emp.id,
                        targetEmployeeId: emp.id,
                        metadata: JSON.stringify({ device: 'Chrome / Windows', timestamp: new Date().toISOString() })
                    }
                });
            }
        }
    }

    console.log('Data population complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
