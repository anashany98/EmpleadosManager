import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Datos de empleados de prueba
const testEmployees = [
    {
        name: 'MARÍA GARCÍA LÓPEZ',
        firstName: 'María',
        lastName: 'García López',
        dni: '12345678A',
        email: 'maria.garcia@nominasapp.com',
        department: 'Recursos Humanos',
        jobTitle: 'Directora de RRHH',
        category: 'Dirección',
        phone: '612345678',
    },
    {
        name: 'CARLOS MARTÍNEZ RUIZ',
        firstName: 'Carlos',
        lastName: 'Martínez Ruiz',
        dni: '23456789B',
        email: 'carlos.martinez@nominasapp.com',
        department: 'IT',
        jobTitle: 'Senior Developer',
        category: 'Oficial de 1ª',
        phone: '623456789',
    },
    {
        name: 'ANA SÁNCHEZ FERNÁNDEZ',
        firstName: 'Ana',
        lastName: 'Sánchez Fernández',
        dni: '34567890C',
        email: 'ana.sanchez@nominasapp.com',
        department: 'Finanzas',
        jobTitle: 'Contable',
        category: 'Oficial de 2ª',
        phone: '634567890',
    },
    {
        name: 'PEDRO GONZÁLEZ TORRES',
        firstName: 'Pedro',
        lastName: 'González Torres',
        dni: '45678901D',
        email: 'pedro.gonzalez@nominasapp.com',
        department: 'Ventas',
        jobTitle: 'Comercial',
        category: 'Oficial de 1ª',
        phone: '645678901',
    },
    {
        name: 'LAURA DÍAZ MORENO',
        firstName: 'Laura',
        lastName: 'Díaz Moreno',
        dni: '56789012E',
        email: 'laura.diaz@nominasapp.com',
        department: 'Marketing',
        jobTitle: 'Marketing Manager',
        category: 'Dirección',
        phone: '656789012',
    },
    {
        name: 'JAVIER RODRÍGUEZ NAVARRO',
        firstName: 'Javier',
        lastName: 'Rodríguez Navarro',
        dni: '67890123F',
        email: 'javier.rodriguez@nominasapp.com',
        department: 'IT',
        jobTitle: 'Junior Developer',
        category: 'Ayudante',
        phone: '667890123',
    },
    {
        name: 'ELENA CASTRO MOLINA',
        firstName: 'Elena',
        lastName: 'Castro Molina',
        dni: '78901234G',
        email: 'elena.castro@nominasapp.com',
        department: 'Recursos Humanos',
        jobTitle: 'Técnico de RRHH',
        category: 'Oficial de 2ª',
        phone: '678901234',
    },
    {
        name: 'MIGUEL ORTIZ DOMÍNGUEZ',
        firstName: 'Miguel',
        lastName: 'Ortiz Domínguez',
        dni: '89012345H',
        email: 'miguel.ortiz@nominasapp.com',
        department: 'Operaciones',
        jobTitle: 'Jefe de Operaciones',
        category: 'Encargado',
        phone: '689012345',
    },
    {
        name: 'SARA JIMÉNEZ VEGA',
        firstName: 'Sara',
        lastName: 'Jiménez Vega',
        dni: '90123456I',
        email: 'sara.jimenez@nominasapp.com',
        department: 'Atención al Cliente',
        jobTitle: 'Supervisora',
        category: 'Encargado',
        phone: '690123456',
    },
    {
        name: 'DANIEL HERRERA SERRANO',
        firstName: 'Daniel',
        lastName: 'Herrera Serrano',
        dni: '01234567J',
        email: 'daniel.herrera@nominasapp.com',
        department: 'Logística',
        jobTitle: 'Coordinador de Logística',
        category: 'Oficial de 1ª',
        phone: '601234567',
    },
];

async function main() {
    console.log('🚀 Iniciando creación de empleados de prueba...\n');

    // Obtener empresa
    const company = await prisma.company.findFirst();
    if (!company) {
        throw new Error('❌ No hay empresa en la base de datos. Ejecuta primero el seed principal.');
    }
    console.log(`✅ Empresa encontrada: ${company.name}\n`);

    let created = 0;
    let updated = 0;

    for (const empData of testEmployees) {
        try {
            // Verificar si ya existe por DNI
            const existing = await prisma.employee.findUnique({
                where: { dni: empData.dni }
            });

            if (existing) {
                // Actualizar
                await prisma.employee.update({
                    where: { id: existing.id },
                    data: {
                        name: empData.name,
                        firstName: empData.firstName,
                        lastName: empData.lastName,
                        email: empData.email,
                        department: empData.department,
                        jobTitle: empData.jobTitle,
                        category: empData.category,
                        phone: empData.phone,
                        active: true,
                    }
                });
                console.log(`📝 Actualizado: ${empData.name} (${empData.department})`);
                updated++;
            } else {
                // Crear nuevo
                const entryDate = new Date();
                entryDate.setMonth(entryDate.getMonth() - Math.floor(Math.random() * 36)); // Antigüedad aleatoria 0-36 meses

                await prisma.employee.create({
                    data: {
                        name: empData.name,
                        firstName: empData.firstName,
                        lastName: empData.lastName,
                        dni: empData.dni,
                        email: empData.email,
                        department: empData.department,
                        jobTitle: empData.jobTitle,
                        category: empData.category,
                        phone: empData.phone,
                        companyId: company.id,
                        active: true,
                        entryDate,
                        workingDayType: 'FULL_TIME',
                    }
                });
                console.log(`✅ Creado: ${empData.name} (${empData.department})`);
                created++;
            }
        } catch (error) {
            console.error(`❌ Error con ${empData.name}:`, error);
        }
    }

    console.log('\n========================================');
    console.log(`📊 Resumen:`);
    console.log(`   - Empleados creados: ${created}`);
    console.log(`   - Empleados actualizados: ${updated}`);
    console.log(`   - Total procesados: ${testEmployees.length}`);
    console.log('========================================\n');
}

main()
    .catch((e) => {
        console.error('❌ Error fatal:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });