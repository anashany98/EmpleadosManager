
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEPARTMENTS = ['IT', 'Recursos Humanos', 'Ventas', 'Marketing', 'Operaciones', 'Finanzas', 'Logística'];
const CONTRACT_TYPES = ['Indefinido', 'Temporal', 'Prácticas', 'Obra y Servicio'];
const AGREEMENT_TYPES = ['Oficinas y Despachos', 'Metal', 'Comercio', 'Hostelería'];
const JOB_TITLES = ['Desarrollador Senior', 'Gerente de Ventas', 'Analista Financiero', 'Operario de Almacén', 'Especialista de HR', 'Director de Marketing', 'Administrativo', 'Becario'];
const FIRST_NAMES = ['Ana', 'Carlos', 'Lucía', 'Miguel', 'Sofia', 'David', 'Elena', 'Jorge', 'Maria', 'Pablo', 'Laura', 'Daniel', 'Carmen', 'Alejandro', 'Isabel', 'Javier', 'Marta', 'Sergio', 'Paula', 'Andres', 'Raquel', 'Fernando', 'Patricia', 'Roberto', 'Beatriz'];
const LAST_NAMES = ['García', 'Rodríguez', 'Fernández', 'Torres', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez'];

function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr: any[]) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start: Date, end: Date) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function main() {
    console.log('🌱 Starting database seed...');

    // Clear existing data
    await prisma.timeEntry.deleteMany({});
    await prisma.overtimeEntry.deleteMany({});
    await prisma.payrollRow.deleteMany({});
    await prisma.payrollImportBatch.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.alert.deleteMany({});
    await prisma.employee.deleteMany({});
    await prisma.company.deleteMany({});

    // Create User
    const admin = await prisma.user.create({
        data: {
            email: 'admin@empresa.com',
            password: 'hashed_password',
            role: 'admin'
        }
    });

    console.log('✅ Admin user created');

    // Create Companies
    const companies = await Promise.all([
        prisma.company.create({ data: { name: 'TechLogistics Solutions', cif: 'B12345678' } }),
        prisma.company.create({ data: { name: 'GreenEnergy Systems', cif: 'B87654321' } }),
        prisma.company.create({ data: { name: 'Global Retailers S.L.', cif: 'B11223344' } })
    ]);

    console.log('✅ Companies created');

    // Create Category Rates
    const CATEGORIAS = ['Grupo 1', 'Grupo 2', 'Grupo 3', 'Grupo 4', 'Grupo 5', 'Grupo 6', 'Grupo 7', 'Oficial de 1ª', 'Oficial de 2ª', 'Oficial de 3ª', 'Peón', 'Otros'];
    const seededRates = await Promise.all(CATEGORIAS.map(cat =>
        prisma.categoryRate.upsert({
            where: { category: cat },
            update: {
                overtimeRate: 15 + Math.random() * 10,
                holidayOvertimeRate: 25 + Math.random() * 15
            },
            create: {
                category: cat,
                overtimeRate: 15 + Math.random() * 10,
                holidayOvertimeRate: 25 + Math.random() * 15
            }
        })
    ));

    const ratesMap = new Map(seededRates.map(r => [r.category, r]));
    console.log('✅ Category rates created (Normal & Holiday)');

    const employees = [];
    const usedDNIs = new Set();
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    // Create 80 Employees
    for (let i = 0; i < 80; i++) {
        let dni;
        do {
            dni = `${randomInt(10000000, 99999999)}${String.fromCharCode(65 + randomInt(0, 25))}`;
        } while (usedDNIs.has(dni));
        usedDNIs.add(dni);

        const firstName = randomItem(FIRST_NAMES);
        const lastName = `${randomItem(LAST_NAMES)} ${randomItem(LAST_NAMES)}`;

        // Randomize active status (90% active)
        const isActive = Math.random() > 0.1;
        const exitDate = !isActive ? randomDate(sixMonthsAgo, now) : null;

        // Dates
        const entryDate = randomDate(new Date('2020-01-01'), now);
        const dniExpiration = randomDate(now, new Date('2030-01-01'));

        // Randomize createdAt to show a nice growth trend in the last 6 months
        const createdAt = new Date(now);
        createdAt.setMonth(now.getMonth() - randomInt(0, 5));
        createdAt.setDate(randomInt(1, 28));

        // Make some DNI expire soon for alerts
        if (Math.random() < 0.1) {
            dniExpiration.setTime(now.getTime() + randomInt(5, 45) * 24 * 60 * 60 * 1000);
        }

        const employee = await prisma.employee.create({
            data: {
                name: `${firstName} ${lastName}`,
                firstName,
                lastName,
                dni,
                email: `${firstName.toLowerCase()}.${lastName.split(' ')[0].toLowerCase()}${i}@empresa.com`.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
                phone: `6${randomInt(10000000, 99999999)}`,
                address: `C/ Ejemplo ${randomInt(1, 100)}`,
                city: 'Madrid',
                postalCode: '28001',
                active: isActive,
                department: randomItem(DEPARTMENTS),
                jobTitle: randomItem(JOB_TITLES),
                contractType: randomItem(CONTRACT_TYPES),
                agreementType: randomItem(AGREEMENT_TYPES),
                subaccount465: `465${String(i).padStart(5, '0')}`, // Sequential to ensure uniqueness
                companyId: randomItem(companies).id,
                entryDate,
                exitDate,
                dniExpiration,
                drivingLicenseExpiration: Math.random() < 0.2 ? randomDate(now, new Date('2028-01-01')) : null,
                vacationDaysTotal: 30,
                createdAt
            }
        });
        employees.push(employee);
    }
    console.log(`✅ Created ${employees.length} employees`);

    // Generate history for active employees
    for (const emp of employees) {
        if (!emp.active) continue;

        // 1. Time Entries (Last 60 days)
        for (let d = 60; d >= 0; d--) {
            const date = new Date(now);
            date.setDate(date.getDate() - d);

            // Skip weekends (mostly)
            if (date.getDay() === 0 || date.getDay() === 6) continue;

            // Random absence (5% chance)
            if (Math.random() < 0.05) continue;

            const checkInHour = 8 + Math.random(); // 8:00 - 9:00
            const checkOutHour = 17 + Math.random(); // 17:00 - 18:00
            const lunchStartHour = 13 + Math.random() * 0.5; // 13:00 - 13:30
            const lunchEndHour = lunchStartHour + 1; // 1 hour lunch

            const checkIn = new Date(date); checkIn.setHours(Math.floor(checkInHour), Math.floor((checkInHour % 1) * 60));
            const checkOut = new Date(date); checkOut.setHours(Math.floor(checkOutHour), Math.floor((checkOutHour % 1) * 60));
            const lunchStart = new Date(date); lunchStart.setHours(Math.floor(lunchStartHour), Math.floor((lunchStartHour % 1) * 60));
            const lunchEnd = new Date(date); lunchEnd.setHours(Math.floor(lunchEndHour), Math.floor((lunchEndHour % 1) * 60));

            const totalHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) - 1; // Minus 1h lunch

            await prisma.timeEntry.create({
                data: {
                    employeeId: emp.id,
                    date: date,
                    checkIn,
                    checkOut,
                    lunchStart,
                    lunchEnd,
                    lunchHours: 1,
                    totalHours: Number(totalHours.toFixed(2))
                }
            }).catch(() => { }); // catch unique constraint errors just in case
        }

        // 2. Overtime (Randomly in the last month)
        if (Math.random() < 0.3) {
            const rateInfo = ratesMap.get(emp.category || 'Otros') as any;
            const rateNormal = rateInfo?.overtimeRate || 20;
            const rateHoliday = rateInfo?.holidayOvertimeRate || 30;

            for (let i = 0; i < randomInt(1, 5); i++) {
                const otDate = new Date(now);
                otDate.setDate(otDate.getDate() - randomInt(1, 45));

                const isHoliday = otDate.getDay() === 0 || otDate.getDay() === 6;
                const appliedRate = isHoliday ? rateHoliday : rateNormal;
                const hours = randomInt(1, 3);

                await prisma.overtimeEntry.create({
                    data: {
                        employeeId: emp.id,
                        date: otDate,
                        hours,
                        rate: appliedRate,
                        total: Number((hours * appliedRate).toFixed(2))
                    }
                });
            }
        }

        // 3. Vacations & Absences
        for (let i = 0; i < 3; i++) {
            if (Math.random() < 0.4) {
                const isSickLeave = Math.random() < 0.3;
                const startDate = new Date(now);
                startDate.setDate(startDate.getDate() - randomInt(1, 150));

                const duration = isSickLeave ? randomInt(1, 5) : randomInt(2, 10);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + duration);

                await prisma.vacation.create({
                    data: {
                        employeeId: emp.id,
                        startDate,
                        endDate,
                        days: duration,
                        type: isSickLeave ? 'SICK_LEAVE' : 'VACATION',
                        reason: isSickLeave ? 'Baja médica' : 'Vacaciones'
                    }
                });
            }
        }
    }

    // 4. Create Payroll Data for BI Cost Report
    const batch = await prisma.payrollImportBatch.create({
        data: {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            sourceFilename: 'nominas_diciembre.xlsx',
            createdById: admin.id,
            status: 'VALIDATED'
        }
    });

    for (const emp of employees) {
        const bruto = 2000 + randomInt(0, 3000);
        await prisma.payrollRow.create({
            data: {
                batchId: batch.id,
                employeeId: emp.id,
                rawEmployeeName: emp.name,
                bruto: bruto,
                ssEmpresa: bruto * 0.32,
                ssTrabajador: bruto * 0.0635,
                irpf: bruto * 0.15,
                neto: bruto * 0.75,
                status: 'OK'
            }
        });
    }

    console.log('✅ Generated Payroll Data');
    console.log('🌱 Seeding cleanup complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
