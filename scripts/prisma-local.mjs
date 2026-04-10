import fs from 'fs';
import net from 'net';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(repoRoot, 'database', 'prisma', 'schema.prisma');

function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }

    return fs
        .readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .reduce((acc, line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                return acc;
            }

            const equalsIndex = trimmed.indexOf('=');
            if (equalsIndex === -1) {
                return acc;
            }

            const key = trimmed.slice(0, equalsIndex).trim();
            let value = trimmed.slice(equalsIndex + 1).trim();

            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            acc[key] = value;
            return acc;
        }, {});
}

function maskUrlSecret(urlString) {
    try {
        const parsed = new URL(urlString);
        if (parsed.password) {
            parsed.password = '***';
        }
        return parsed.toString();
    } catch {
        return urlString;
    }
}

function canConnect(host, port) {
    return new Promise((resolve) => {
        const socket = net.createConnection({ host, port: Number(port) });
        const timeout = setTimeout(() => {
            socket.destroy();
            resolve(false);
        }, 1000);

        socket.on('connect', () => {
            clearTimeout(timeout);
            socket.destroy();
            resolve(true);
        });

        socket.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
        });
    });
}

const rootEnv = parseEnvFile(path.join(repoRoot, '.env'));
const backendEnv = parseEnvFile(path.join(repoRoot, 'backend', '.env'));
const mergedEnv = { ...rootEnv, ...backendEnv, ...process.env };

const parsedDatabaseUrl = (() => {
    try {
        return mergedEnv.DATABASE_URL ? new URL(mergedEnv.DATABASE_URL) : null;
    } catch {
        return null;
    }
})();

const dbProtocol = parsedDatabaseUrl?.protocol?.replace(':', '') || 'postgresql';
const dbUser = mergedEnv.POSTGRES_USER || parsedDatabaseUrl?.username || 'nominas';
const dbPassword = mergedEnv.POSTGRES_PASSWORD || parsedDatabaseUrl?.password || 'nominas_local_pw_2026';
const dbHost = mergedEnv.POSTGRES_HOST || parsedDatabaseUrl?.hostname || 'localhost';
const dbPort = mergedEnv.POSTGRES_PORT || parsedDatabaseUrl?.port || '5432';
const dbName = mergedEnv.POSTGRES_DB || parsedDatabaseUrl?.pathname?.replace(/^\//, '') || 'nominas_db';
const dbSchema = parsedDatabaseUrl?.searchParams?.get('schema') || 'public';

const effectiveDatabaseUrl = `${dbProtocol}://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}?schema=${dbSchema}`;
const prismaArgs = process.argv.slice(2);
const args = ['prisma', ...prismaArgs];

if (!args.includes('--schema')) {
    args.push('--schema', schemaPath);
}

const reachable = await canConnect(dbHost, dbPort);

console.log(`[prisma-local] schema=${schemaPath}`);
console.log(`[prisma-local] db=${maskUrlSecret(effectiveDatabaseUrl)}`);
if (!reachable) {
    console.warn(`[prisma-local] warning: ${dbHost}:${dbPort} is not reachable. Start the local stack or adjust POSTGRES_PORT/DATABASE_URL.`);
}

const child = process.platform === 'win32'
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', `npx prisma ${args.slice(1).join(' ')}`], {
        cwd: repoRoot,
        stdio: 'inherit',
        env: {
            ...process.env,
            ...mergedEnv,
            DATABASE_URL: effectiveDatabaseUrl
        }
    })
    : spawn('npx', args, {
        cwd: repoRoot,
        stdio: 'inherit',
        env: {
            ...process.env,
            ...mergedEnv,
            DATABASE_URL: effectiveDatabaseUrl
        }
    });

child.on('error', (error) => {
    console.error('[prisma-local] failed to launch Prisma', error);
    process.exit(1);
});

child.on('exit', (code) => {
    process.exit(code ?? 1);
});
