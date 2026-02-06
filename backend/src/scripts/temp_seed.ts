
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

    // Create 67 Employees (Requested by user)
    for (let i = 0; i < 67; i++) {
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
                contractEndDate: isActive && Math.random() < 0.5 ? randomDate(now, new Date('2026-01-01')) : null,
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

            await prisma.timeEntry.create({ data: { employeeId: emp.id, type: 'IN', timestamp: checkIn } }).catch(() => { });
            await prisma.timeEntry.create({ data: { employeeId: emp.id, type: 'LUNCH_START', timestamp: lunchStart } }).catch(() => { });
            await prisma.timeEntry.create({ data: { employeeId: emp.id, type: 'LUNCH_END', timestamp: lunchEnd } }).catch(() => { });
            await prisma.timeEntry.create({ data: { employeeId: emp.id, type: 'OUT', timestamp: checkOut } }).catch(() => { });
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
                        total: Number((hours * appliedRate).toFixed(2)),
                        status: randomItem(['APPROVED', 'APPROVED', 'PENDING']) // Mostly approved
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
                        reason: isSickLeave ? 'Baja médica' : 'Vacaciones',
                        status: randomItem(['APPROVED', 'APPROVED', 'PENDING'])
                    }
                });
            }
        }

        // 4. Contract Extensions (for some)
        if (emp.active && Math.random() < 0.3) {
            await prisma.contractExtension.create({
                data: {
                    employeeId: emp.id,
                    extensionDate: randomDate(emp.entryDate || new Date(), now),
                    newEndDate: randomDate(now, new Date('2027-01-01')),
                    notes: 'Prórroga convenio 2024'
                }
            });
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

    // 5. Create Expenses (for some employees)
    for (const emp of employees.filter(e => e.active)) {
        if (Math.random() < 0.4) {
            const numExpenses = randomInt(1, 4);
            for (let i = 0; i < numExpenses; i++) {
                await prisma.expense.create({
                    data: {
                        employeeId: emp.id,
                        date: randomDate(sixMonthsAgo, now),
                        category: randomItem(['MEAL', 'TRAVEL', 'SUPPLIES', 'OTHER']),
                        amount: 10 + Math.random() * 150,
                        description: randomItem([
                            'Comida de trabajo con cliente',
                            'Kilometraje desplazamiento',
                            'Material de oficina',
                            'Parking reunión externa',
                            'Formación online'
                        ]),
                        status: randomItem(['APPROVED', 'APPROVED', 'PENDING', 'REJECTED']),
                        paymentMethod: randomItem(['CASH', 'CARD', 'TRANSFER'])
                    }
                });
            }
        }
    }
    console.log('✅ Generated Expenses');

    // 6. Create Assets (laptops, phones, tools, clothing)
    const assetCategories = ['LAPTOP', 'MOBILE', 'TOOLS', 'CLOTHING', 'OTHER'];
    const assetNames = {
        LAPTOP: ['MacBook Pro 14', 'Dell Latitude 5420', 'HP EliteBook 840', 'Lenovo ThinkPad X1'],
        MOBILE: ['iPhone 13', 'Samsung Galaxy S22', 'iPhone 14 Pro', 'Xiaomi 12'],
        TOOLS: ['Destornillador eléctrico', 'Taladro Bosch', 'Kit herramientas', 'Medidor láser'],
        CLOTHING: ['Pantalón trabajo', 'Chaleco reflectante', 'Botas seguridad', 'Casco obra'],
        OTHER: ['Silla ergonómica', 'Monitor 27"', 'Teclado mecánico', 'Ratón inalámbrico']
    };

    for (const emp of employees.filter(e => e.active).slice(0, 40)) {
        const numAssets = randomInt(1, 3);
        for (let i = 0; i < numAssets; i++) {
            const category = randomItem(assetCategories);
            await prisma.asset.create({
                data: {
                    employeeId: emp.id,
                    category,
                    name: randomItem(assetNames[category as keyof typeof assetNames]),
                    serialNumber: category === 'LAPTOP' || category === 'MOBILE' ? `SN${randomInt(100000, 999999)}` : null,
                    size: category === 'CLOTHING' ? randomItem(['S', 'M', 'L', 'XL', 'XXL']) : null,
                    assignedDate: randomDate(emp.entryDate || sixMonthsAgo, now),
                    status: 'ASSIGNED'
                }
            });
        }
    }
    console.log('✅ Generated Assets');

    // 7. Create Documents
    const documentCategories = ['CONTRACT', 'DNI', 'PAYROLL', 'MEDICAL', 'TRAINING', 'OTHER'];
    for (const emp of employees.slice(0, 50)) {
        const numDocs = randomInt(2, 5);
        for (let i = 0; i < numDocs; i++) {
            const category = randomItem(documentCategories);
            await prisma.document.create({
                data: {
                    employeeId: emp.id,
                    name: `${category} - ${emp.firstName}`,
                    category,
                    fileUrl: `/uploads/documents/${emp.dni}_${category.toLowerCase()}.pdf`,
                    expiryDate: category === 'DNI' ? emp.dniExpiration : null
                }
            });
        }
    }
    console.log('✅ Generated Documents');

    // 8. Create Medical Reviews
    for (const emp of employees.filter(e => e.active).slice(0, 45)) {
        if (Math.random() < 0.6) {
            await prisma.medicalReview.create({
                data: {
                    employeeId: emp.id,
                    date: randomDate(new Date('2023-01-01'), now),
                    result: randomItem(['APTO', 'APTO', 'APTO', 'APTO CON LIMITACIONES']),
                    nextReviewDate: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
                }
            });
        }
    }
    console.log('✅ Generated Medical Reviews');

    // 9. Create Trainings
    const trainingTypes = ['PRL', 'Técnica', 'Habilidades', 'Idiomas', 'Certificación'];
    const trainingNames = [
        'Prevención de Riesgos Laborales',
        'Trabajo en Altura',
        'Manipulador de Alimentos',
        'Primeros Auxilios',
        'Excel Avanzado',
        'Gestión de Equipos',
        'Inglés B2',
        'Certificación Scrum Master',
        'Carretilla Elevadora'
    ];

    for (const emp of employees.filter(e => e.active).slice(0, 50)) {
        const numTrainings = randomInt(1, 3);
        for (let i = 0; i < numTrainings; i++) {
            await prisma.training.create({
                data: {
                    employeeId: emp.id,
                    type: randomItem(trainingTypes),
                    name: randomItem(trainingNames),
                    date: randomDate(new Date('2022-01-01'), now),
                    hours: randomInt(8, 40)
                }
            });
        }
    }
    console.log('✅ Generated Trainings');

    // 10. Create Alerts
    const activeEmployees = employees.filter(e => e.active);

    // DNI expiring alerts
    for (const emp of activeEmployees) {
        if (emp.dniExpiration) {
            const daysUntilExpiry = Math.floor((emp.dniExpiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
                await prisma.alert.create({
                    data: {
                        employeeId: emp.id,
                        type: 'DNI_EXPIRING',
                        severity: daysUntilExpiry <= 10 ? 'HIGH' : 'MEDIUM',
                        title: 'DNI próximo a caducar',
                        message: `El DNI de ${emp.name} caduca en ${daysUntilExpiry} días`,
                        actionUrl: `/employees/${emp.id}`
                    }
                });
            }
        }

        // Contract expiring alerts
        if (emp.contractEndDate) {
            const daysUntilExpiry = Math.floor((emp.contractEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
                await prisma.alert.create({
                    data: {
                        employeeId: emp.id,
                        type: 'CONTRACT_EXPIRING',
                        severity: daysUntilExpiry <= 15 ? 'HIGH' : 'MEDIUM',
                        title: 'Contrato próximo a vencer',
                        message: `El contrato de ${emp.name} vence en ${daysUntilExpiry} días`,
                        actionUrl: `/employees/${emp.id}`
                    }
                });
            }
        }
    }
    console.log('✅ Generated Alerts');

    // 11. Create Checklist Tasks (Onboarding for recent employees)
    const recentEmployees = employees.filter(e => {
        if (!e.entryDate || !e.active) return false;
        const monthsAgo = (now.getTime() - e.entryDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        return monthsAgo <= 3;
    }).slice(0, 10);

    const onboardingTasks = [
        'Crear email corporativo',
        'Asignar portátil y móvil',
        'Formación de seguridad',
        'Completar documentación RRHH',
        'Configurar accesos sistemas',
        'Presentación al equipo',
        'Revisión médica inicial'
    ];

    for (const emp of recentEmployees) {
        for (const taskTitle of onboardingTasks) {
            const completed = Math.random() > 0.3;
            await prisma.checklistTask.create({
                data: {
                    employeeId: emp.id,
                    type: 'ONBOARDING',
                    title: taskTitle,
                    description: `Tarea de incorporación para ${emp.name}`,
                    completed,
                    completedAt: completed ? randomDate(emp.entryDate || sixMonthsAgo, now) : null,
                    deadline: emp.entryDate ? new Date(emp.entryDate.getTime() + 14 * 24 * 60 * 60 * 1000) : null
                }
            });
        }
    }
    console.log('✅ Generated Onboarding Checklists');

    console.log('\n🎉 Database seed complete!');
    console.log(`   - ${employees.length} employees`);
    console.log(`   - ${companies.length} companies`);
    console.log('   - Time entries, overtime, vacations');
    console.log('   - Payroll data');
    console.log('   - Expenses, assets, documents');
    console.log('   - Trainings, medical reviews');
    console.log('   - Alerts and checklists');
    console.log('🌱 Ready for screenshots!\n');

}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
