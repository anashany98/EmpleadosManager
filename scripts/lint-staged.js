#!/usr/bin/env node
/**
 * Router de lint-staged para el monorepo.
 *
 * Hasta ahora lint-staged en `package.json` raíz llamaba a `eslint --fix` y
 * `tsc --noEmit` directamente, pero la raíz no tiene ni eslint ni tsc en su
 * `node_modules`. Resultado: el hook fallaba en cada commit (los commits del
 * bot anterior lo evitaban con `--no-verify`).
 *
 * Este script recibe de lint-staged las rutas absolutas de los archivos
 * modificados, los agrupa por paquete (`backend/`, `frontend/`, raíz) y
 * delega en los binarios de cada paquete.
 *
 * Funciona en Windows + Unix sin dependencias externas (sólo módulos nativos
 * de Node).
 */
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const stagedFiles = process.argv.slice(2);

if (stagedFiles.length === 0) {
    process.exit(0);
}

// Normalizar separadores (Windows usa `\`, pero los prefijos del repo son `/`).
const groups = { backend: [], frontend: [], root: [] };
for (const file of stagedFiles) {
    if (file.includes('node_modules')) continue;
    const normalized = file.replace(/\\/g, '/');
    // Detectar paquete por prefijo de la ruta absoluta o relativa.
    if (/^[A-Z]:\/[^/]+\/backend\//i.test(normalized) || normalized.startsWith('backend/')) {
        groups.backend.push(file);
    } else if (/^[A-Z]:\/[^/]+\/frontend\//i.test(normalized) || normalized.startsWith('frontend/')) {
        groups.frontend.push(file);
    } else {
        groups.root.push(file);
    }
}

/**
 * Ejecuta un binario de un subproyecto. Devuelve true si exit 0.
 * En Windows, los binarios `.cmd` requieren `shell: true` para que
 * spawnSync no devuelva EINVAL al invocarlos.
 */
function runBin(pkgDir, binName, args) {
    const isWindows = process.platform === 'win32';
    const binExt = isWindows ? '.cmd' : '';
    const binPath = path.join(
        repoRoot,
        pkgDir,
        'node_modules',
        '.bin',
        `${binName}${binExt}`
    );
    const cwd = path.join(repoRoot, pkgDir);
    const result = spawnSync(binPath, args, {
        cwd,
        stdio: 'inherit',
        // En Windows con .cmd hace falta shell para que CreateProcess no rechace.
        // En Unix se puede dejar a false (más seguro contra injection).
        shell: isWindows
    });
    if (result.error) {
        console.error(`[lint-staged] No se pudo ejecutar ${binPath}:`, result.error.message);
        return false;
    }
    return result.status === 0;
}

function runRootBin(binName, args) {
    const isWindows = process.platform === 'win32';
    const binExt = isWindows ? '.cmd' : '';
    const binPath = path.join(repoRoot, 'node_modules', '.bin', `${binName}${binExt}`);
    const result = spawnSync(binPath, args, {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: isWindows
    });
    if (result.error) {
        console.error(`[lint-staged] No se pudo ejecutar ${binPath}:`, result.error.message);
        return false;
    }
    return result.status === 0;
}

let ok = true;

// Backend
if (groups.backend.length > 0) {
    const tsTargets = groups.backend.filter((f) => /\.(ts|tsx)$/.test(f));
    if (tsTargets.length > 0) {
        console.log(`[lint-staged] eslint --fix backend (${tsTargets.length} archivos)`);
        ok = runBin('backend', 'eslint', ['--fix', ...tsTargets]) && ok;
    }
    console.log('[lint-staged] tsc --noEmit --skipLibCheck backend');
    ok = runBin('backend', 'tsc', ['--noEmit', '--skipLibCheck']) && ok;
}

// Frontend
if (groups.frontend.length > 0) {
    const tsTargets = groups.frontend.filter((f) => /\.(ts|tsx)$/.test(f));
    if (tsTargets.length > 0) {
        console.log(`[lint-staged] eslint --fix frontend (${tsTargets.length} archivos)`);
        ok = runBin('frontend', 'eslint', ['--fix', ...tsTargets]) && ok;
    }
    console.log('[lint-staged] tsc --noEmit --skipLibCheck frontend');
    ok = runBin('frontend', 'tsc', ['--noEmit', '--skipLibCheck']) && ok;
}

// Raíz (prettier sobre package.json, .md, .env.example, etc.)
const prettierTargets = stagedFiles.filter((f) =>
    /\.(json|md|css|scss|yml|yaml)$/.test(f)
);
if (prettierTargets.length > 0) {
    console.log(`[lint-staged] prettier --write (${prettierTargets.length} archivos raíz)`);
    ok = runRootBin('prettier', ['--write', ...prettierTargets]) && ok;
}

if (!ok) {
    console.error('[lint-staged] Algún gate falló. Aborta el commit.');
}
process.exit(ok ? 0 : 1);
