/** @type {import('ts-jest').JestConfigWithTsJest} */

// Here are some notes about what I found trying to convert jest to use ESM. The
// motivation was that the latest version of "nanoid" is ESM-only, and the tests
// broke when we tried to use it. This configuration works, but the "rxjs"
// package won't load correctly. jest keeps getting confused if it's cjs or esm.
// If I "unplug" rxjs and manually modify the package.json to only have cjs
// exports it works. I haven't been able to figure out how to make it work with
// mjs exports. I think rxjs needs to be clearer about what its "default" export
// style is, and hopefully be explicit about it, as suggested in
// https://nodejs.org/en/blog/release/v21.1.0

module.exports = {
  testEnvironment: 'jsdom',
  preset: 'ts-jest/presets/default-esm',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ES6',
          target: 'ES6',
        },
      },
    ],
  },
}
