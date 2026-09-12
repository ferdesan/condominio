/** @type {import('ts-jest').JestConfigWithTSJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.entity.ts',
    '!src/database/migrations/**',
    '!src/server.ts',
  ],
  coverageThreshold: {
    global: { branches: 45, functions: 55, lines: 60, statements: 60 },
  },
  clearMocks: true,
  testTimeout: 30000,
  transform: {
    '^.+[.]ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
};
