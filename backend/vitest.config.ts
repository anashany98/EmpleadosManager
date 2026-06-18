import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
        setupFiles: ['./src/tests/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            exclude: [
                'node_modules/**',
                'dist/**',
                '**/*.test.ts',
                '**/*.spec.ts',
                '**/setup.ts',
                '**/index.ts',
            ],
            thresholds: {
                // Production-readiness coverage gates. The previous
                // values (30/20/40/30) were set when the project had
                // almost no tests. After Sprint 2 (added 34+ unit
                // tests across PayrollAutomationService,
                // VacationBalanceService, TimeEntryController and
                // SalaryEncryption), we can safely raise the floor.
                //
                // 70% statements / 50% branches is the minimum the
                // team agreed on for go-live. The CI build fails the
                // PR if any of these are not met, so coverage is
                // monitored on every push.
                //
                // IMPORTANT: this gate is enforced by CI which runs
                // with PostgreSQL + Redis services. In environments
                // where only unit tests can run (no DB), the
                // coverage report only includes the unit-tested
                // files and will report a much higher coverage; the
                // gate still passes because we use `perFile: false`
                // (the default). When DB-backed integration tests are
                // added to the suite, the per-file metric will
                // naturally lower. Re-evaluate the gate after the
                // 90-day integration test push.
                //
                // 90-day plan: push statements/branches to 80% once
                // the test suite covers the remaining report and
                // dashboard services.
                statements: 70,
                branches: 50,
                functions: 75,
                lines: 70,
                // `perFile` keeps the gate at the project aggregate
                // level rather than per-file. This avoids failing the
                // build on a single new file with no tests yet; we
                // prefer to track per-file coverage in the HTML
                // report and act on it in code review.
                perFile: false
            },
        },
    },
    resolve: {
        alias: {
            shared: path.resolve(__dirname, '../shared'),
        },
    },
});
