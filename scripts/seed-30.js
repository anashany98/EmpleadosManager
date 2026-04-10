const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

const DEPARTMENTS = ['IT', 'Recursos Humanos', 'Ventas', 'Marketing', 'Operaciones', 'Finanzas', 'Logística'];
const CONTRACT_TYPES = ['Indefinido', 'Temporal', 'Prácticas', 'Obra y Servicio'];
const AGREEMENT_TYPES = ['Oficinas y Despachos', 'Metal', 'Comercio', 'Hostelería'];
const JOB_TITLES = ['Desarrollador Senior', 'Gerente de Ventas', 'Analista Financiero', 'Operario de Almacén', 'Especialista de HR', 'Director de Marketing', 'Administrativo', 'Becario'];
const FIRST_NAMES = ['Ana', 'Carlos', 'Lucía', 'Miguel', 'Sofia', 'David', 'Elena', 'Jorge', 'Maria', 'Pablo', 'Laura', 'Daniel', 'Carmen', 'Alejandro', 'Isabel', 'Javier', 'Marta', 'Sergio', 'Paula', 'Andres', 'Raquel', 'Fernando', 'Patricia', 'Roberto', 'Beatriz'];
const LAST_NAMES = ['García', 'Rodríguez', 'Fernández', 'Torres', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez'];

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomDate(start, end) { return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())); }

async function main() {
    console.log('🌱 Starting database seed...');
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const admin = await prisma.user.create({
        data: { 
            email: 'admin@empresa.com', 
            password: await bcrypt.hash('admin123', 10), 
            role: 'admin', 
            permissions: JSON.stringify({ employees: 'write', payroll: 'write', companies: 'write', calendar: 'write', audit: 'write', assets: 'write', reports: 'write', timesheet: 'write', projects: 'write' }) 
        }
    });
    console.log('✅ Admin user created (admin@empresa.com / admin123)');

    const companies = await Promise.all([
        prisma.company.create({ data: { name: 'TechLogistics Solutions', cif: 'B12345678' } }),
        prisma.company.create({ data: { name: 'GreenEnergy Systems', cif: 'B87654321' } }),
        prisma.company.create({ data: { name: 'Global Retailers S.L.', cif: 'B11223344' } })
    ]);
    console.log('✅ Companies created');

    const CATEGORIAS = ['Grupo 1', 'Grupo 2', 'Grupo 3', 'Grupo 4', 'Grupo 5', 'Grupo 6', 'Grupo 7', 'Oficial de 1ª', 'Oficial de 2ª', 'Oficial de 3ª', 'Peón', 'Otros'];
    await Promise.all(CATEGORIAS.map(cat => prisma.categoryRate.upsert({
        where: { category: cat },
        update: {},
        create: { category: cat, overtimeRate: 15 + Math.random() * 10, holidayOvertimeRate: 25 + Math.random() * 15 }
    })));
    console.log('✅ Category rates created');

    const employees = [];
    const usedDNIs = new Set();
    for (let i = 0; i < 30; i++) {
        let dni;
        do { dni = `${randomInt(10000000, 99999999)}${String.fromCharCode(65 + randomInt(0, 25))}`; } while (usedDNIs.has(dni));
        usedDNIs.add(dni);

        const firstName = randomItem(FIRST_NAMES);
        const lastName = `${randomItem(LAST_NAMES)} ${randomItem(LAST_NAMES)}`;
        const isActive = Math.random() > 0.1;
        const entryDate = randomDate(new Date('2020-01-01'), now);
        const dniExpiration = randomDate(now, new Date('2030-01-01'));

        const employee = await prisma.employee.create({
            data: {
                name: `${firstName} ${lastName}`, firstName, lastName, dni,
                email: `${firstName.toLowerCase()}.${lastName.split(' ')[0].toLowerCase()}${i}@empresa.com`.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
                phone: `6${randomInt(10000000, 99999999)}`, address: `C/ Ejemplo ${randomInt(1, 100)}`, city: 'Madrid', postalCode: '28001',
                active: isActive, department: randomItem(DEPARTMENTS), jobTitle: randomItem(JOB_TITLES),
                contractType: randomItem(CONTRACT_TYPES), agreementType: randomItem(AGREEMENT_TYPES),
                subaccount465: `465${String(i).padStart(5, '0')}`, companyId: randomItem(companies).id,
                entryDate, dniExpiration, vacationDaysTotal: 30, drivingLicenseExpiration: Math.random() < 0.2 ? randomDate(now, new Date('2028-01-01')) : null
            }
        });
        employees.push(employee);
    }
    console.log(`✅ Created ${employees.length} employees`);

    const batch = await prisma.payrollImportBatch.create({
        data: { year: now.getFullYear(), month: now.getMonth() + 1, sourceFilename: 'nominas_seed.xlsx', createdById: admin.id, status: 'VALIDATED' }
    });

    for (const emp of employees) {
        for (let d = 30; d >= 0; d--) {
            const date = new Date(now);
            date.setDate(date.getDate() - d);
            if (date.getDay() === 0 || date.getDay() === 6) continue;
            if (Math.random() < 0.05) continue;

            const checkInHour = 8 + Math.random();
            const checkOutHour = 17 + Math.random();
            const lunchStartHour = 13 + Math.random() * 0.5;

            const checkIn = new Date(date); checkIn.setHours(Math.floor(checkInHour), Math.floor((checkInHour % 1) * 60));
            const checkOut = new Date(date); checkOut.setHours(Math.floor(checkOutHour), Math.floor((checkOutHour % 1) * 60));
            const lunchStart = new Date(date); lunchStart.setHours(Math.floor(lunchStartHour), Math.floor((lunchStartHour % 1) * 60));
            const lunchEnd = new Date(lunchStart); lunchEnd.setHours(lunchStart.getHours() + 1);

            await prisma.timeEntry.create({ data: { employeeId: emp.id, type: 'IN', timestamp: checkIn } }).catch(() => {});
            await prisma.timeEntry.create({ data: { employeeId: emp.id, type: 'LUNCH_START', timestamp: lunchStart } }).catch(() => {});
            await prisma.timeEntry.create({ data: { employeeId: emp.id, type: 'LUNCH_END', timestamp: lunchEnd } }).catch(() => {});
            await prisma.timeEntry.create({ data: { employeeId: emp.id, type: 'OUT', timestamp: checkOut } }).catch(() => {});
        }

        for (let i = 0; i < randomInt(2, 4); i++) {
            const isSickLeave = Math.random() < 0.3;
            const startDate = new Date(now); startDate.setDate(startDate.getDate() - randomInt(1, 150));
            const duration = isSickLeave ? randomInt(1, 5) : randomInt(2, 10);
            const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + duration);

            await prisma.vacation.create({
                data: { employeeId: emp.id, startDate, endDate, days: duration, type: isSickLeave ? 'SICK_LEAVE' : 'VACATION', reason: isSickLeave ? 'Baja médica' : 'Vacaciones', status: randomItem(['APPROVED', 'APPROVED', 'PENDING']) }
            });
        }

        const bruto = 2000 + randomInt(0, 3000);
        await prisma.payrollRow.create({
            data: { employeeId: emp.id, rawEmployeeName: emp.name, bruto, ssEmpresa: bruto * 0.32, ssTrabajador: bruto * 0.0635, irpf: bruto * 0.15, neto: bruto * 0.75, status: 'OK', batchId: batch.id }
        });

        if (Math.random() < 0.5) {
            for (let i = 0; i < randomInt(1, 3); i++) {
                await prisma.expense.create({
                    data: { employeeId: emp.id, date: randomDate(sixMonthsAgo, now), category: randomItem(['MEAL', 'TRAVEL', 'SUPPLIES', 'OTHER']), amount: 10 + Math.random() * 150, description: randomItem(['Comida de trabajo', 'Kilometraje', 'Material de oficina', 'Parking', 'Formación']), status: randomItem(['APPROVED', 'APPROVED', 'PENDING']), paymentMethod: randomItem(['CASH', 'CARD', 'TRANSFER']) }
                });
            }
        }

        if (Math.random() < 0.6) {
            for (let i = 0; i < randomInt(1, 2); i++) {
                const category = randomItem(['LAPTOP', 'MOBILE', 'TOOLS', 'CLOTHING']);
                await prisma.asset.create({
                    data: { employeeId: emp.id, category, name: randomItem(['MacBook Pro', 'Dell Latitude', 'iPhone 13', 'Samsung Galaxy', 'Destornillador', 'Taladro', 'Pantalón trabajo', 'Chaleco']), serialNumber: category === 'LAPTOP' || category === 'MOBILE' ? `SN${randomInt(100000, 999999)}` : null, size: category === 'CLOTHING' ? randomItem(['S', 'M', 'L', 'XL']) : null, assignedDate: randomDate(emp.entryDate, now), status: 'ASSIGNED' }
                });
            }
        }

        for (let i = 0; i < randomInt(2, 4); i++) {
            const category = randomItem(['CONTRACT', 'DNI', 'PAYROLL', 'MEDICAL', 'TRAINING']);
            await prisma.document.create({
                data: { employeeId: emp.id, name: `${category} - ${emp.firstName}`, category, fileUrl: `/uploads/documents/${emp.dni}_${category.toLowerCase()}.pdf`, expiryDate: category === 'DNI' ? emp.dniExpiration : null }
            });
        }

        if (Math.random() < 0.6) {
            await prisma.medicalReview.create({
                data: { employeeId: emp.id, date: randomDate(new Date('2023-01-01'), now), result: randomItem(['APTO', 'APTO', 'APTO', 'APTO CON LIMITACIONES']), nextReviewDate: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()) }
            });
        }

        for (let i = 0; i < randomInt(1, 3); i++) {
            await prisma.training.create({
                data: { employeeId: emp.id, type: randomItem(['PRL', 'Técnica', 'Habilidades', 'Idiomas']), name: randomItem(['Prevención de Riesgos Laborales', 'Trabajo en Altura', 'Primeros Auxilios', 'Excel Avanzado', 'Gestión de Equipos', 'Inglés B2']), date: randomDate(new Date('2022-01-01'), now), hours: randomInt(8, 40) }
            });
        }

        if (emp.dniExpiration) {
            const daysUntil = Math.floor((emp.dniExpiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 30 && daysUntil > 0) {
                await prisma.alert.create({
                    data: { employeeId: emp.id, type: 'DNI_EXPIRING', severity: daysUntil <= 10 ? 'HIGH' : 'MEDIUM', title: 'DNI próximo a caducar', message: `El DNI de ${emp.name} caduca en ${daysUntil} días`, actionUrl: `/employees/${emp.id}` }
                });
            }
        }
    }

    console.log('✅ All data generated');
    console.log('🎉 Seed complete!');
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });