import { PrismaClient } from '@prisma/client';

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
                    // fiscalName, address, city, etc not in schema
                }
            });
        }
        companyIds.push(company.id);
    }

    const users = await prisma.user.findMany();
    const adminUser = users.find(u => u.role === 'ADMIN') || users[0];

    // Helper to generate random valid-ish DNI
    const generateDNI = () => {
        const num = Math.floor(Math.random() * 100000000);
        const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
        return num.toString().padStart(8, '0') + letters[num % 23];
    };

    // Helper for random names
    const firstNames = ["Antonio", "Manuel", "Jose", "Francisco", "David", "Juan", "Javier", "Daniel", "Maria", "Carmen", "Ana", "Isabel", "Laura", "Cristina", "Marta", "Sara", "Lucia", "Elena", "Paula", "Raquel"];
    const lastNames = ["Garcia", "Gonzalez", "Rodriguez", "Fernandez", "Lopez", "Martinez", "Sanchez", "Perez", "Gomez", "Martin", "Jimenez", "Ruiz", "Hernandez", "Diaz", "Moreno", "Muñoz", "Alvarez", "Romero"];

    // 2. Create 20 Employees
    console.log('Generating 20 new employees...');

    // Create a mock batch for their payrolls
    const batch = await prisma.payrollImportBatch.create({
        data: {
            sourceFilename: 'Nominas_Generadas_Auto.xlsx',
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            status: 'COMPLETED',
            createdById: adminUser?.id || 'system',
            notes: 'Batch generado automáticamente para nuevos empleados'
        }
    });

    for (let i = 0; i < 20; i++) {
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)] + " " + lastNames[Math.floor(Math.random() * lastNames.length)];
        const fullName = `${firstName} ${lastName}`;
        const dni = generateDNI();
        const companyId = companyIds[Math.floor(Math.random() * companyIds.length)]; // Randomly assign to one of the 2 companies

        // Ensure unique subaccount
        const subaccount = '465' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');

        const employee = await prisma.employee.create({
            data: {
                name: fullName,
                firstName: firstName,
                lastName: lastName,
                dni: dni,
                subaccount465: subaccount,
                email: `${firstName.toLowerCase()}.${lastName.split(' ')[0].toLowerCase()}${Math.floor(Math.random() * 100)}@email.com`,
                phone: '6' + Math.floor(Math.random() * 100000000).toString(),
                address: `C/ Aleatoria ${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 10)}º ${['A', 'B', 'C'][Math.floor(Math.random() * 3)]}`,
                city: 'Madrid',
                postalCode: '2800' + Math.floor(Math.random() * 9),
                province: 'Madrid',
                socialSecurityNumber: '28' + Math.floor(Math.random() * 10000000000).toString(),
                iban: 'ES' + Math.floor(Math.random() * 100) + ' ' + Math.floor(Math.random() * 10000) + ' ' + Math.floor(Math.random() * 10000) + ' ' + Math.floor(Math.random() * 10000) + ' ' + Math.floor(Math.random() * 10000),
                gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
                birthDate: new Date(1970 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)),
                entryDate: new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)),
                department: ['Ventas', 'Administración', 'Técnico', 'Almacén'][Math.floor(Math.random() * 4)],
                jobTitle: ['Técnico', 'Administrativo', 'Gerente', 'Operario'][Math.floor(Math.random() * 4)],
                contractType: ['Indefinido', 'Temporal', 'Prácticas'][Math.floor(Math.random() * 3)],
                companyId: companyId,
                active: true,
                // Add some realistic expiration dates
                dniExpiration: new Date(new Date().setFullYear(new Date().getFullYear() + Math.floor(Math.random() * 5))),
            }
        });

        console.log(`Created employee: ${fullName} (${dni}) assigned to company ID: ${companyId}`);

        // Add Payroll Row
        await prisma.payrollRow.create({
            data: {
                batchId: batch.id,
                employeeId: employee.id,
                rawEmployeeName: fullName,
                bruto: 1500 + Math.random() * 1500,
                neto: 1200 + Math.random() * 1000,
                irpf: 200 + Math.random() * 300,
                ssEmpresa: 500 + Math.random() * 200,
                ssTrabajador: 100 + Math.random() * 100,
                status: 'COMPLETED'
            }
        });

        // Add Vacation request
        if (Math.random() > 0.3) {
            await prisma.vacation.create({
                data: {
                    employeeId: employee.id,
                    startDate: new Date(2025, 6, 1 + Math.floor(Math.random() * 15)), // July
                    endDate: new Date(2025, 6, 15 + Math.floor(Math.random() * 15)),
                    type: 'VACATION',
                    status: Math.random() > 0.5 ? 'APPROVED' : 'PENDING',
                    reason: 'Vacaciones de verano'
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
