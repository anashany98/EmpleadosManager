const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const DEPARTMENTS = ['IT', 'Recursos Humanos', 'Ventas', 'Marketing', 'Operaciones', 'Finanzas', 'Logistica'];
const CONTRACT_TYPES = ['Indefinido', 'Temporal', 'Practicas', 'Obra y Servicio'];
const JOB_TITLES = ['Desarrollador Senior', 'Gerente de Ventas', 'Analista Financiero', 'Operario de Almacen', 'Especialista de HR', 'Director de Marketing', 'Administrativo', 'Becario'];
const FIRST_NAMES = ['Ana', 'Carlos', 'Lucia', 'Miguel', 'Sofia', 'David', 'Elena', 'Jorge', 'Maria', 'Pablo', 'Laura', 'Daniel', 'Carmen', 'Alejandro', 'Isabel', 'Javier', 'Marta', 'Sergio', 'Paula', 'Andres'];
const LAST_NAMES = ['Garcia', 'Rodriguez', 'Fernandez', 'Torres', 'Lopez', 'Martinez', 'Sanchez', 'Perez', 'Gomez', 'Martin', 'Jimenez', 'Ruiz', 'Hernandez', 'Diaz', 'Moreno', 'Munoz', 'Alvarez', 'Romero'];

function rInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rDate(start, end) { return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())); }

async function main() {
    console.log('SEED: Starting...');
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const admin = await prisma.user.create({ data: { email: 'admin@empresa.com', password: await bcrypt.hash('admin123', 10), role: 'admin', permissions: JSON.stringify({ employees:'write', payroll:'write', companies:'write', calendar:'write', audit:'write', assets:'write', reports:'write', timesheet:'write', projects:'write' }) } });
    console.log('Admin user created');

    const companies = await Promise.all([ prisma.company.create({ data: { name: 'TechLogistics Solutions', cif: 'B12345678' } }), prisma.company.create({ data: { name: 'GreenEnergy Systems', cif: 'B87654321' } }), prisma.company.create({ data: { name: 'Global Retailers SL', cif: 'B11223344' } }) ]);
    console.log('Companies created');

    const cats = ['Grupo 1', 'Grupo 2', 'Grupo 3', 'Grupo 4', 'Grupo 5', 'Oficial 1a', 'Oficial 2a', 'Peon'];
    await Promise.all(cats.map(c => prisma.categoryRate.upsert({ where: { category: c }, update: {}, create: { category: c, overtimeRate: 15 + Math.random() * 10, holidayOvertimeRate: 25 + Math.random() * 15 } })));
    console.log('Category rates created');

    const employees = [];
    const used = new Set();
    for (let i = 0; i < 30; i++) {
        let dni;
        do { dni = rInt(10000000, 99999999) + String.fromCharCode(65 + rInt(0, 25)); } while (used.has(dni));
        used.add(dni);
        const fn = rItem(FIRST_NAMES);
        const ln = rItem(LAST_NAMES) + ' ' + rItem(LAST_NAMES);
        const emp = await prisma.employee.create({
            data: { name: fn + ' ' + ln, firstName: fn, lastName: ln, dni: dni, email: fn.toLowerCase() + '.' + ln.split(' ')[0].toLowerCase() + i + '@empresa.com', phone: '6' + rInt(10000000, 99999999), address: 'C/ Ejemplo ' + rInt(1,100), city: 'Madrid', postalCode: '28001', active: Math.random() > 0.1, department: rItem(DEPARTMENTS), jobTitle: rItem(JOB_TITLES), contractType: rItem(CONTRACT_TYPES), agreementType: 'Oficinas y Despachos', subaccount465: '465' + String(i).padStart(5,'0'), companyId: rItem(companies).id, entryDate: rDate(new Date('2020-01-01'), now), dniExpiration: rDate(now, new Date('2030-01-01')), vacationDaysTotal: 30, drivingLicenseExpiration: Math.random() < 0.2 ? rDate(now, new Date('2028-01-01')) : null }
        });
        employees.push(emp);
    }
    console.log('Created ' + employees.length + ' employees');

    const batch = await prisma.payrollImportBatch.create({ data: { year: now.getFullYear(), month: now.getMonth() + 1, sourceFilename: 'nominas_seed.xlsx', createdById: admin.id, status: 'VALIDATED' } });

    for (const emp of employees) {
        for (let d = 30; d >= 0; d--) {
            const date = new Date(now); date.setDate(date.getDate() - d);
            if (date.getDay() === 0 || date.getDay() === 6) continue;
            if (Math.random() < 0.05) continue;
            const checkIn = new Date(date); checkIn.setHours(8, rInt(0,59));
            const checkOut = new Date(date); checkOut.setHours(17, rInt(0,59));
            const lunchStart = new Date(date); lunchStart.setHours(13, rInt(0,30));
            const lunchEnd = new Date(lunchStart); lunchEnd.setHours(14, rInt(0,30));
            await prisma.timeEntry.create({ data: { employeeId: emp.id, type: 'IN', timestamp: checkIn } }).catch(()=>{});
            await prisma.timeEntry.create({ data: { employeeId: emp.id, type: 'LUNCH_START', timestamp: lunchStart } }).catch(()=>{});
            await prisma.timeEntry.create({ data: { employeeId: emp.id, type: 'LUNCH_END', timestamp: lunchEnd } }).catch(()=>{});
            await prisma.timeEntry.create({ data: { employeeId: emp.id, type: 'OUT', timestamp: checkOut } }).catch(()=>{});
        }
        for (let i = 0; i < rInt(2,4); i++) {
            const isSick = Math.random() < 0.3;
            const start = new Date(now); start.setDate(start.getDate() - rInt(1,150));
            const dur = isSick ? rInt(1,5) : rInt(2,10);
            await prisma.vacation.create({ data: { employeeId: emp.id, startDate: start, endDate: new Date(start.getTime() + dur*86400000), days: dur, type: isSick ? 'SICK_LEAVE' : 'VACATION', reason: isSick ? 'Baja medica' : 'Vacaciones', status: rItem(['APPROVED','APPROVED','PENDING']) } });
        }
        const bruto = 2000 + rInt(0,3000);
        await prisma.payrollRow.create({ data: { employeeId: emp.id, rawEmployeeName: emp.name, bruto: bruto, ssEmpresa: bruto*0.32, ssTrabajador: bruto*0.0635, irpf: bruto*0.15, neto: bruto*0.75, status: 'OK', batchId: batch.id } });
        if (Math.random() < 0.5) for (let i = 0; i < rInt(1,3); i++) await prisma.expense.create({ data: { employeeId: emp.id, date: rDate(sixMonthsAgo, now), category: rItem(['MEAL','TRAVEL','SUPPLIES','OTHER']), amount: 10 + Math.random()*150, description: rItem(['Comida trabajo','Kilometraje','Material oficina','Parking','Formacion']), status: rItem(['APPROVED','APPROVED','PENDING']), paymentMethod: rItem(['CASH','CARD','TRANSFER']) } });
        if (Math.random() < 0.6) for (let i = 0; i < rInt(1,2); i++) { const cat = rItem(['LAPTOP','MOBILE','TOOLS','CLOTHING']); await prisma.asset.create({ data: { employeeId: emp.id, category: cat, name: rItem(['MacBook Pro','Dell Latitude','iPhone 13','Samsung Galaxy','Destornillador','Taladro','Pantalon trabajo','Chaleco']), serialNumber: cat==='LAPTOP'||cat==='MOBILE'?'SN'+rInt(100000,999999):null, size: cat==='CLOTHING'?rItem(['S','M','L','XL']):null, assignedDate: rDate(emp.entryDate, now), status: 'ASSIGNED' } }); }
        for (let i = 0; i < rInt(2,4); i++) { const cat = rItem(['CONTRACT','DNI','PAYROLL','MEDICAL','TRAINING']); await prisma.document.create({ data: { employeeId: emp.id, name: cat + ' - ' + emp.firstName, category: cat, fileUrl: '/uploads/documents/' + emp.dni + '_' + cat.toLowerCase() + '.pdf', expiryDate: cat==='DNI'?emp.dniExpiration:null } }); }
        if (Math.random() < 0.6) await prisma.medicalReview.create({ data: { employeeId: emp.id, date: rDate(new Date('2023-01-01'), now), result: rItem(['APTO','APTO','APTO','APTO CON LIMITACIONES']), nextReviewDate: new Date(now.getFullYear()+1, now.getMonth(), now.getDate()) } });
        for (let i = 0; i < rInt(1,3); i++) await prisma.training.create({ data: { employeeId: emp.id, type: rItem(['PRL','Tecnica','Habilidades','Idiomas']), name: rItem(['Prevencion Riesgos Laborales','Trabajo en Altura','Primeros Auxilios','Excel Avanzado','Gestion Equipos','Ingles B2']), date: rDate(new Date('2022-01-01'), now), hours: rInt(8,40) } });
        if (emp.dniExpiration) { const days = Math.floor((emp.dniExpiration.getTime() - now.getTime()) / 86400000); if (days <= 30 && days > 0) await prisma.alert.create({ data: { employeeId: emp.id, type: 'DNI_EXPIRING', severity: days <= 10 ? 'HIGH' : 'MEDIUM', title: 'DNI proximo a caducar', message: 'El DNI de ' + emp.name + ' caduca en ' + days + ' dias', actionUrl: '/employees/' + emp.id } }); }
    }
    console.log('SEED: Complete!');
    await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });