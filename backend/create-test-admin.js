// LEGACY: este script .js tiene credenciales y rutas hardcodeadas.
// Para uso real, emplea `backend/src/scripts/seed-admin.ts` o
// `backend/src/scripts/deploy_admin.ts`, que leen de variables de entorno.
// Sólo se conserva aquí porque algún flujo legacy (CI, test manual) lo invoca.

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
    datasources: {
        db: { url: 'postgresql://nominas:nominas_local_pw_2026@127.0.0.1:5432/nominas_db?schema=public' }
    }
});

async function main() {
    const email = 'test@test.com';
    const password = 'TestAdmin123!!';
    // Mantener sincronía con la política global (ver backend/src/utils/bcryptRounds.ts).
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
    const hashed = await bcrypt.hash(password, rounds);

    const user = await prisma.user.upsert({
        where: { email },
        update: { password: hashed, role: 'admin' },
        create: { email, password: hashed, role: 'admin' }
    });
    console.log('User created:', user.email);
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
