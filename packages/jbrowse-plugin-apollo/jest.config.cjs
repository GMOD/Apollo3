/* eslint-disable @typescript-eslint/no-require-imports */

/** @type {import('ts-jest').JestConfigWithTsJest} */

const { createDefaultEsmPreset } = require('ts-jest')

module.exports = {
  testPathIgnorePatterns: ['<rootDir>/cypress/'],
  automock: false,
  setupFiles: ['./jestSetup.js', 'fake-indexeddb/auto'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}'],
  ...createDefaultEsmPreset(),
}
