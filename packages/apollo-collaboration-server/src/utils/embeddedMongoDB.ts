import fs from 'node:fs/promises'
import path from 'node:path'

import { Logger } from '@nestjs/common'
import type { MongoMemoryServer } from 'mongodb-memory-server-core'

const logger = new Logger('EmbeddedMongoDB')

// Both Mongoose (in AppModule) and the session store (in main.ts) need the
// URI, so share one server between them
let serverPromise: Promise<MongoMemoryServer> | undefined

async function startServer(dbPath: string): Promise<MongoMemoryServer> {
  const resolvedDBPath = path.resolve(dbPath)
  await fs.mkdir(resolvedDBPath, { recursive: true })
  logger.warn(
    `Starting an embedded MongoDB with data in "${resolvedDBPath}". This is ` +
      'meant for trying out Apollo, not for production use. The first start ' +
      'downloads a MongoDB binary, which can take a while.',
  )
  // Imported here so it's only loaded when embedded mode is used
  const { MongoMemoryServer } = await import('mongodb-memory-server-core')
  return MongoMemoryServer.create({
    instance: { dbPath: resolvedDBPath, storageEngine: 'wiredTiger' },
  })
}

/**
 * Start (once) an embedded MongoDB server that stores its data in `dbPath`,
 * and return its connection URI
 */
export async function getEmbeddedMongoDBURI(dbPath: string): Promise<string> {
  serverPromise ??= startServer(dbPath)
  const server = await serverPromise
  return server.getUri('apolloDb')
}

/** Stop the embedded MongoDB server, if one was started */
export async function stopEmbeddedMongoDB(): Promise<void> {
  if (!serverPromise) {
    return
  }
  const server = await serverPromise
  // Keep the data in dbPath so it's still there on the next start
  await server.stop({ doCleanup: false })
}
