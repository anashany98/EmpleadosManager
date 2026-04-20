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
                statements: 50,
                branches: 40,
                functions: 45,
                lines: 50,
            },
        },
    },
    resolve: {
        alias: {
            shared: path.resolve(__dirname, '../shared'),
        },
    },
});
