import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['**/*.test.js', '**/*.test.mjs'],
        globals: true,
        testTimeout: 10000,
    },
});
