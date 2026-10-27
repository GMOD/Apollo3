const SERVER_MAIN = 'current/packages/apollo-collaboration-server/dist/main.js'

export interface StartScript {
  fileName: string
  content: string
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", String.raw`'\''`)}'`
}

/**
 * Render the script that starts the collaboration server. It runs Node
 * directly with Yarn's PnP hooks, like the Dockerfile's CMD, rather than
 * through `yarn start:prod`, since Yarn exits on SIGTERM before the server
 * has shut down cleanly. It runs from the install directory so the server
 * finds the `.env` there, and goes through the `current` link so it doesn't
 * change between versions.
 */
export function renderStartScript(
  platform: NodeJS.Platform,
  installDir: string,
): StartScript {
  if (platform === 'win32') {
    // --experimental-loader takes a URL, so it needs forward slashes
    return {
      fileName: 'start-apollo.cmd',
      content: [
        '@echo off',
        `cd /d "${installDir}"`,
        'set NODE_ENV=production',
        String.raw`node --require .\current\.pnp.cjs ^`,
        '  --experimental-loader ./current/.pnp.loader.mjs ^',
        `  ${SERVER_MAIN.replaceAll('/', '\\')}`,
        '',
      ].join('\r\n'),
    }
  }
  return {
    fileName: 'start-apollo.sh',
    content: [
      '#!/bin/sh',
      `cd ${shellQuote(installDir)} || exit 1`,
      'NODE_ENV=production exec node --require ./current/.pnp.cjs \\',
      '  --experimental-loader ./current/.pnp.loader.mjs \\',
      `  ./${SERVER_MAIN}`,
      '',
    ].join('\n'),
  }
}
