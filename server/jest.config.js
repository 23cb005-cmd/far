/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  setupFiles: ['<rootDir>/src/__tests__/env.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', 'src/__tests__/(env\\.)?setup\\.ts$'],
  moduleNameMapper: {
    // Resolve the shared package from source so tests never depend on build order.
    '^@farmfair/shared$': '<rootDir>/../shared/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'Node',
          target: 'ES2022',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          skipLibCheck: true,
          isolatedModules: false,
          resolveJsonModule: true,
        },
        diagnostics: { warnOnly: true },
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/__tests__/**'],
  coverageDirectory: 'coverage',
  testTimeout: 60000,
  maxWorkers: 1,
  clearMocks: true,
  restoreMocks: true,
};
