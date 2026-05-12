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
                statements: 30,
                branches: 20,
                functions: 40,
                lines: 30,
            },
        },
    },
    resolve: {
        alias: {
            shared: path.resolve(__dirname, '../shared'),
        },
    },
});
