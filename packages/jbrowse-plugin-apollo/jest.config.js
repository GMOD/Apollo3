/** @type {import('ts-jest').JestConfigWithTsJest} */

module.exports = {
  preset: 'ts-jest',
  testPathIgnorePatterns: ['<rootDir>/cypress/'],
  automock: false,
  setupFiles: ['./jestSetup.js', 'fake-indexeddb/auto'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}'],
}
