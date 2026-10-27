import path from 'node:path'

import { runNode } from './run.js'
import { serverPackageDir } from './server.js'

/**
 * Download the MongoDB binary that the embedded MongoDB uses, with the
 * release's own copy of mongodb-memory-server, so the server's first start
 * doesn't have to. The server finds it through MONGOMS_DOWNLOAD_DIR in the
 * `.env`.
 */
export async function downloadMongoDBBinary(
  releaseDir: string,
  downloadDir: string,
): Promise<void> {
  const script =
    "require('mongodb-memory-server-core').MongoBinary.getPath()" +
    '.then((binary) => console.log(`MongoDB binary: ${binary}`))'
  await runNode(
    'mongodb',
    ['--require', path.join(releaseDir, '.pnp.cjs'), '--eval', script],
    {
      cwd: serverPackageDir(releaseDir),
      // mongodb-memory-server reuses a binary in the home directory's cache
      // if MONGOMS_DOWNLOAD_DIR doesn't have one yet, so point the home
      // directory away from that cache. The binary then always ends up in
      // MONGOMS_DOWNLOAD_DIR, where every user (e.g. a service account)
      // finds it.
      env: {
        MONGOMS_DOWNLOAD_DIR: downloadDir,
        HOME: downloadDir,
        USERPROFILE: downloadDir,
      },
    },
  )
}
