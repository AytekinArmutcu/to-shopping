/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/db/migrations/**'],
  // Die Fachlogik (features/*/logic.ts) ist der Grund, warum es diese Tests gibt.
  // Siehe docs/decisions.md, ADR-008.
};
