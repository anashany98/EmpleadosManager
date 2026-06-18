// Smoke test runner: lint + typecheck + unit tests (no DB/Redis).
// Run with: `node scripts/smoke-no-deps.mjs`
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const log = (msg) => console.log(`[smoke] ${msg}`);

function run(cmd, args, cwd, opts = {}) {
    log(`> ${cmd} ${args.join(' ')}  (cwd=${path.relative(ROOT, cwd) || '.'})`);
    const r = spawnSync(cmd, args, {
        cwd,
        stdio: opts.captureStderr ? 'pipe' : 'inherit',
        shell: true
    });
    return { ok: r.status === 0, stdout: r.stdout, stderr: r.stderr, status: r.status };
}

const steps = [
    { name: 'backend typecheck', cmd: 'npx', args: ['tsc', '--noEmit'], cwd: path.join(ROOT, 'backend') },
    { name: 'frontend typecheck', cmd: 'npx', args: ['tsc', '--noEmit'], cwd: path.join(ROOT, 'frontend') },
    {
        name: 'backend unit tests',
        cmd: 'npx',
        args: [
            'vitest', 'run',
            'src/tests/unit/SalaryEncryption.test.ts',
            'src/tests/authz.test.ts',
            'src/tests/MultiTenancy.test.ts',
            'src/tests/configValidator.test.ts',
            'src/tests/security/auditService.test.ts',
            'src/tests/security/fileValidation.test.ts'
        ],
        cwd: path.join(ROOT, 'backend')
    },
    { name: 'backend lint', cmd: 'npm', args: ['run', 'lint'], cwd: path.join(ROOT, 'backend') },
    { name: 'frontend lint', cmd: 'npm', args: ['run', 'lint'], cwd: path.join(ROOT, 'frontend') }
];

let allPassed = true;
for (const step of steps) {
    log(`-- ${step.name} --`);
    // Always capture stderr so we can show it on failure
    const result = run(step.cmd, step.args, step.cwd, { captureStderr: true });
    if (!result.ok) {
        // Re-emit the captured output so the operator can see WHY the
        // step failed.
        if (result.stdout) process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
        log(`FAILED: ${step.name} (exit ${result.status})`);
        allPassed = false;
    } else if (step.name.includes('lint')) {
        // For lint, only show stderr (warnings) to keep the log tidy.
        if (result.stderr) process.stderr.write(result.stderr);
        if (result.stdout) {
            // Lint outputs the "N problems" line to stdout on success;
            // surface it as a one-liner.
            const lastLines = result.stdout.toString().split('\n').filter(Boolean).slice(-3);
            log(`(ok; ${lastLines.join(' | ')})`);
        }
    } else {
        // For non-lint steps, only show stderr preview if any.
        if (result.stderr) {
            const lines = result.stderr.toString().split('\n').filter(Boolean);
            if (lines.length > 0) {
                log(`(stderr preview: ${lines.slice(0, 3).join(' | ')}${lines.length > 3 ? ' ...' : ''})`);
            }
        }
    }
}

if (!allPassed) {
    log('Some steps failed. See above.');
    process.exit(1);
}
log('All smoke checks passed.');
