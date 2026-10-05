import { setTimeout as sleep } from 'node:timers/promises'

import {
  Injectable,
  Logger,
  type MessageEvent,
  type OnModuleDestroy,
  type OnModuleInit,
  Optional,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectConnection } from '@nestjs/mongoose'
import { type Connection, Types, type mongo } from 'mongoose'
import QuickLRU from 'quick-lru'
import { Subject } from 'rxjs'

export const EVENTS_COLLECTION_NAME = 'serverevents'
const DEFAULT_EVENTS_COLLECTION_SIZE = 64 * 1024 * 1024 // 64 MiB

/** Placeholder so a tailable cursor never starts on an empty collection */
const INIT_EVENT_TYPE = '__init'

/**
 * How far back (in seconds) to look when (re)opening the tailable cursor.
 * ObjectIds made by different processes in the same second aren't ordered by
 * insertion, so a strict `_id > lastSeen` filter could skip events. Instead we
 * look a little further back and drop the events we've already seen.
 */
const REWIND_SECONDS = 5
const MAX_BACKOFF_MS = 5000

interface ServerEventDocument {
  _id: Types.ObjectId
  type: string
  data: object
}

interface MessagesConfig {
  EVENTS_COLLECTION_SIZE?: number
}

/**
 * Broadcasts server-sent events to every client, whichever server process
 * they are connected to.
 *
 * Events are written to a capped MongoDB collection that each process tails,
 * so this works with several processes (e.g. PM2 cluster mode) and doesn't
 * need a replica set. Without a database connection (e.g. in unit tests)
 * events are only delivered within this process.
 */
@Injectable()
export class MessagesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagesService.name)
  private readonly events = new Subject<MessageEvent>()
  private collection?: mongo.Collection<ServerEventDocument>
  private cursor?: mongo.FindCursor<ServerEventDocument>
  private ready?: Promise<void>
  private stopped = false
  private lastSeenId?: Types.ObjectId
  private readonly seenIds = new QuickLRU<string, true>({ maxSize: 10_000 })

  constructor(
    @Optional() @InjectConnection() private readonly connection?: Connection,
    @Optional()
    private readonly configService?: ConfigService<MessagesConfig, true>,
  ) {}

  async onModuleInit() {
    if (!this.connection) {
      return
    }
    await (this.ready ??= this.ensureCollection())
    await this.markRecentEventsSeen()
    void this.tail()
  }

  async onModuleDestroy() {
    this.stopped = true
    await this.cursor?.close()
    this.events.complete()
  }

  broadcast(eventName: string, payload: object) {
    if (!this.connection) {
      this.events.next({
        type: eventName,
        data: payload,
        id: new Types.ObjectId().toHexString(),
      })
      return
    }
    // Local subscribers get this from the tailer too, so every process
    // delivers events in the same order
    void this.publish(eventName, payload)
  }

  subscribe() {
    return this.events.asObservable()
  }

  private async publish(type: string, data: object) {
    try {
      await (this.ready ??= this.ensureCollection())
      if (!this.collection) {
        throw new Error('Events collection is not initialized')
      }
      await this.collection.insertOne({ _id: new Types.ObjectId(), type, data })
    } catch (error) {
      this.logger.error(
        `Failed to broadcast "${type}" event`,
        error instanceof Error ? error.stack : String(error),
      )
    }
  }

  private async ensureCollection() {
    const { db } = this.connection ?? {}
    if (!db) {
      throw new Error('No database connection for server-sent events')
    }
    const size =
      this.configService?.get('EVENTS_COLLECTION_SIZE', { infer: true }) ??
      DEFAULT_EVENTS_COLLECTION_SIZE
    try {
      await db.createCollection(EVENTS_COLLECTION_NAME, { capped: true, size })
    } catch (error) {
      // Already exists, maybe created by another process at the same time
      if ((error as { code?: number }).code !== 48) {
        throw error
      }
    }
    const collection = db.collection<ServerEventDocument>(
      EVENTS_COLLECTION_NAME,
    )
    if (!(await collection.isCapped())) {
      throw new Error(
        `The "${EVENTS_COLLECTION_NAME}" collection exists but is not capped. Drop it and restart so it can be recreated.`,
      )
    }
    if ((await collection.estimatedDocumentCount()) === 0) {
      await collection.insertOne({
        _id: new Types.ObjectId(),
        type: INIT_EVENT_TYPE,
        data: {},
      })
    }
    this.collection = collection
  }

  /**
   * Events from just before this process started have already been delivered
   * by the processes that were running then, so don't deliver them again
   */
  private async markRecentEventsSeen() {
    const { collection } = this
    if (!collection) {
      return
    }
    const startedAt = Math.floor(Date.now() / 1000)
    const recent = collection
      .find(
        {
          _id: {
            $gte: Types.ObjectId.createFromTime(startedAt - REWIND_SECONDS),
          },
        },
        { projection: { _id: 1 } },
      )
      .map(({ _id }) => _id.toHexString())
    for await (const id of recent) {
      this.seenIds.set(id, true)
    }
  }

  /** Follow the events collection, reopening the cursor if it closes */
  private async tail() {
    const { collection } = this
    if (!collection) {
      return
    }
    let backoff = 100
    while (!this.stopped) {
      try {
        if (!this.lastSeenId) {
          const newest = await collection.findOne(
            {},
            { sort: { $natural: -1 }, projection: { _id: 1 } },
          )
          this.lastSeenId = newest?._id
        }
        // The filter must match at least one existing event (the last one we
        // saw), or MongoDB closes the tailable cursor right away
        const fromSeconds = this.lastSeenId
          ? Math.floor(this.lastSeenId.getTimestamp().getTime() / 1000) -
            REWIND_SECONDS
          : 0
        const cursor = collection.find(
          { _id: { $gte: Types.ObjectId.createFromTime(fromSeconds) } },
          { tailable: true, awaitData: true },
        )
        this.cursor = cursor
        let gotEvents = false
        for await (const event of cursor) {
          gotEvents = true
          backoff = 100
          this.handleEvent(event)
        }
        if (!gotEvents) {
          // The last event we saw has rolled out of the capped collection
          this.lastSeenId = undefined
        }
      } catch (error) {
        // onModuleDestroy() can set this while awaiting
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (this.stopped) {
          return
        }
        this.logger.error(
          'Error while following server-sent events, reconnecting',
          error instanceof Error ? error.stack : String(error),
        )
      }
      // onModuleDestroy() can set this while awaiting
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (this.stopped) {
        return
      }
      await sleep(backoff)
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
    }
  }

  private handleEvent(event: ServerEventDocument) {
    const id = event._id.toHexString()
    this.lastSeenId = event._id
    if (this.seenIds.has(id)) {
      return
    }
    this.seenIds.set(id, true)
    if (event.type === INIT_EVENT_TYPE) {
      return
    }
    this.events.next({ type: event.type, data: event.data, id })
  }
}
