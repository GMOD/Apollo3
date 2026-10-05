/* eslint-disable @typescript-eslint/no-require-imports */

/** @type {import('ts-jest').JestConfigWithTsJest} */

const { createDefaultEsmPreset } = require('ts-jest')

const defaultEsmPreset = createDefaultEsmPreset()
// eslint-disable-next-line unicorn/prefer-string-raw
defaultEsmPreset.transform['^.+\\.m?tsx?$'][1].tsconfig = {
  module: 'nodenext',
  moduleResolution: 'nodenext',
}

module.exports = {
  testPathIgnorePatterns: ['<rootDir>/cypress/'],
  automock: false,
  setupFiles: ['./jestSetup.js', 'fake-indexeddb/auto'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}'],
  coverageReporters: ['text-summary', ['lcov', { projectRoot: '../..' }]],
  // Let ESM-style ".js" relative imports resolve to TypeScript sources, e.g.
  // in the example plugin's source, which the tests load
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  ...defaultEsmPreset,
}
