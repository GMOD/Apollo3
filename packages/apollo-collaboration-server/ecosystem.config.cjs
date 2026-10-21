// PM2 configuration for running several server processes on one host. Build
// first (`yarn build`), then start with `pm2 start ecosystem.config.cjs`.
// Settings are read from `.env` in this directory, and every process must use
// the same MONGODB_URI, FILE_UPLOAD_FOLDER, JWT_SECRET and SESSION_SECRET.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('node:fs')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('node:path')

// `yarn start:prod` sets up Yarn Plug'n'Play for us, but PM2 runs node
// directly, so load it here
const repoRoot = path.resolve(__dirname, '..', '..')
const pnpRequire = path.join(repoRoot, '.pnp.cjs')
const pnpLoader = path.join(repoRoot, '.pnp.loader.mjs')
const nodeArgs = fs.existsSync(pnpRequire)
  ? ['--require', pnpRequire, '--experimental-loader', pnpLoader]
  : []

module.exports = {
  apps: [
    {
      name: 'apollo-collaboration-server',
      script: 'dist/main.js',
      cwd: __dirname,
      exec_mode: 'cluster',
      // Number of processes, 'max' is one per CPU. Change it while running
      // with `pm2 scale apollo-collaboration-server <number>`.
      instances: 'max',
      node_args: nodeArgs,
      env: { NODE_ENV: 'production' },
      // Give in-flight requests time to finish when stopping or reloading
      kill_timeout: 10_000,
    },
  ],
}
