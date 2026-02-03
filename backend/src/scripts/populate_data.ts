import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting data population...');

    // 1. Ensure requested companies exist
    const companyNames = ['Decoraciones Egea', 'Teoneg'];
    const companyIds: string[] = [];

    for (const name of companyNames) {
        let company = await prisma.company.findFirst({ where: { name } });
        if (!company) {
            console.log(`Creating company: ${name}`);
            company = await prisma.company.create({
                data: {
                    name,
                    cif: 'B' + Math.floor(Math.random() * 100000000).toString(),
                }
            });
        }
        companyIds.push(company.id);
    }

    // 2. Create Specific User: ANAS HANY LAHROUDY
    const anasDni = '49480953h';
    const anasEmail = 'anas.hany@nominasapp.com';
    const anasPassword = await bcrypt.hash('password123', 10);

    let anasUser = await prisma.user.findUnique({ where: { dni: anasDni } });
    if (!anasUser) {
        console.log('Creating Admin User: Anas Hany Lahroudy');
        anasUser = await prisma.user.create({
            data: {
                email: anasEmail,
                dni: anasDni,
                password: anasPassword,
                role: 'ADMIN',
                permissions: JSON.stringify({ all: true }) // Give full permissions
            }
        });
    }

    // 3. Create Employee Profile for Anas
    let anasEmployee = await prisma.employee.findUnique({ where: { dni: anasDni } });
    if (!anasEmployee) {
        console.log('Creating Employee Profile: Anas Hany Lahroudy');
        anasEmployee = await prisma.employee.create({
            data: {
                name: 'Anas Hany Lahroudy',
                firstName: 'Anas',
                lastName: 'Hany Lahroudy',
                dni: anasDni,
                email: anasEmail,
                companyId: companyIds[0], // Assign to first company
                department: 'Dirección',
                jobTitle: 'CEO / Admin',
                category: 'Grupo 1',
                active: true,
                entryDate: new Date('2020-01-01'),
                workingDayType: 'FULL_TIME',
            }
        });

        // Link User to Employee
        await prisma.user.update({
            where: { id: anasUser.id },
            data: { employeeId: anasEmployee.id }
        });
    }


    // 4. Generate Random Employees
    console.log('Generating 30 random employees to make the app look alive...');

    // Helper to generate random valid-ish DNI
    const generateDNI = () => {
        const num = Math.floor(Math.random() * 100000000);
        const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
        return num.toString().padStart(8, '0') + letters[num % 23];
    };

    const firstNames = ["Antonio", "Manuel", "Jose", "Francisco", "David", "Juan", "Javier", "Daniel", "Maria", "Carmen", "Ana", "Isabel", "Laura", "Cristina", "Marta", "Sara", "Lucia", "Elena", "Paula", "Raquel", "Pedro", "Jesus", "Miguel", "Angel", "Alejandro", "Rosa", "Pilar", "Dolores", "Teresa"];
    const lastNames = ["Garcia", "Gonzalez", "Rodriguez", "Fernandez", "Lopez", "Martinez", "Sanchez", "Perez", "Gomez", "Martin", "Jimenez", "Ruiz", "Hernandez", "Diaz", "Moreno", "Muñoz", "Alvarez", "Romero", "Navarro", "Torres", "Dominguez"];

    const jobs = ['Desarrollador', 'Contable', 'RRHH', 'Ventas', 'Marketing', 'Operario', 'Gerente', 'Analista', 'Diseñador', 'Consultor'];
    const depts = ['Tecnología', 'Finanzas', 'Recursos Humanos', 'Comercial', 'Marketing', 'Operaciones', 'Dirección'];

    // Create a mock batch for payrolls
    const batch = await prisma.payrollImportBatch.create({
        data: {
            sourceFilename: 'Datos_Demo_Generados.xlsx',
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            status: 'COMPLETED',
            createdById: anasUser.id,
            notes: 'Datos demo generados automáticamente'
        }
    });

    for (let i = 0; i < 30; i++) {
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)] + " " + lastNames[Math.floor(Math.random() * lastNames.length)];
        const fullName = `${firstName} ${lastName}`;
        const dni = generateDNI();

        // Skip if exists
        const exists = await prisma.employee.findUnique({ where: { dni } });
        if (exists) continue;

        const companyId = companyIds[Math.floor(Math.random() * companyIds.length)];

        const employee = await prisma.employee.create({
            data: {
                name: fullName,
                firstName: firstName,
                lastName: lastName,
                dni: dni,
                email: `${firstName.toLowerCase()}.${lastName.split(' ')[0].toLowerCase()}${Math.floor(Math.random() * 999)}@nominasapp.com`,
                phone: '6' + Math.floor(Math.random() * 90000000).toString(),
                address: `C/ Aleatoria ${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 10)}º`,
                city: 'Madrid',
                province: 'Madrid',
                companyId: companyId,
                active: true,
                department: depts[Math.floor(Math.random() * depts.length)],
                jobTitle: jobs[Math.floor(Math.random() * jobs.length)],
                category: `Grupo ${Math.floor(Math.random() * 5) + 1}`,
                contractType: Math.random() > 0.8 ? 'Temporal' : 'Indefinido',
                workingDayType: Math.random() > 0.9 ? 'PART_TIME' : 'FULL_TIME',
                weeklyHours: 40,
                entryDate: new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), 1),
                vacationDaysTotal: 30,
            }
        });

        // Add Payroll Row
        await prisma.payrollRow.create({
            data: {
                batchId: batch.id,
                employeeId: employee.id,
                rawEmployeeName: fullName,
                bruto: 1500 + Math.random() * 2000,
                neto: 1200 + Math.random() * 1500,
                irpf: 200 + Math.random() * 500,
                ssEmpresa: 500 + Math.random() * 700,
                ssTrabajador: 100 + Math.random() * 200,
                status: 'COMPLETED'
            }
        });

        // Add some random vacation requests
        if (Math.random() > 0.6) {
            await prisma.vacation.create({
                data: {
                    employeeId: employee.id,
                    startDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, Math.floor(Math.random() * 10) + 1),
                    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, Math.floor(Math.random() * 10) + 10),
                    type: 'VACATION',
                    status: 'APPROVED',
                    reason: 'Vacaciones generadas',
                    days: 5
                }
            });
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
