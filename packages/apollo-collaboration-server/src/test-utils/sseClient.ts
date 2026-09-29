/** A single event parsed from a `text/event-stream` response */
export interface ServerSentEvent {
  /** The event name, defaults to "message" if none was sent */
  type: string
  /** The raw data string, with multiple "data:" lines joined by newlines */
  data: string
  id?: string
}

/**
 * Parse a block of SSE lines (one event, without the trailing blank line)
 * into an event. Returns undefined if the block has no data (e.g. comments).
 */
function parseEventBlock(block: string): ServerSentEvent | undefined {
  let type = 'message'
  let id: string | undefined
  const data: string[] = []
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) {
      continue
    }
    const colonIndex = line.indexOf(':')
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex)
    let value = colonIndex === -1 ? '' : line.slice(colonIndex + 1)
    if (value.startsWith(' ')) {
      value = value.slice(1)
    }
    switch (field) {
      case 'event': {
        type = value
        break
      }
      case 'data': {
        data.push(value)
        break
      }
      case 'id': {
        id = value
        break
      }
    }
  }
  if (data.length === 0) {
    return undefined
  }
  return { type, data: data.join('\n'), id }
}

/**
 * Minimal SSE client for tests. Unlike `EventSource`, it exposes the HTTP
 * response (so status and headers can be checked) and lets tests await events
 * one at a time.
 */
export class SSEClient {
  private readonly controller = new AbortController()
  private readonly queue: ServerSentEvent[] = []
  private waiters: ((event: ServerSentEvent) => void)[] = []
  private buffer = ''
  private reading: Promise<void> | undefined

  response: Response | undefined

  constructor(
    private readonly url: string | URL,
    private readonly headers: Record<string, string> = {},
  ) {}

  /** Open the connection and start reading events if the response is OK */
  async connect(): Promise<Response> {
    const response = await fetch(this.url, {
      headers: { Accept: 'text/event-stream', ...this.headers },
      signal: this.controller.signal,
    })
    this.response = response
    if (response.ok && response.body) {
      this.reading = this.read(response.body)
    }
    return response
  }

  private async read(body: ReadableStream<Uint8Array>) {
    const decoder = new TextDecoder()
    const reader = body.getReader()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) {
          return
        }
        this.buffer += decoder.decode(value, { stream: true })
        const blocks = this.buffer.split(/\r?\n\r?\n/)
        this.buffer = blocks.pop() ?? ''
        for (const block of blocks) {
          const event = parseEventBlock(block)
          if (event) {
            this.push(event)
          }
        }
      }
    } catch (error) {
      if (!this.controller.signal.aborted) {
        throw error
      }
    }
  }

  private push(event: ServerSentEvent) {
    const waiter = this.waiters.shift()
    if (waiter) {
      waiter(event)
    } else {
      this.queue.push(event)
    }
  }

  /** Resolve with the next event received, or reject after `timeoutMs` */
  nextEvent(timeoutMs = 5000): Promise<ServerSentEvent> {
    const queued = this.queue.shift()
    if (queued) {
      return Promise.resolve(queued)
    }
    return new Promise((resolve, reject) => {
      const waiter = (event: ServerSentEvent) => {
        clearTimeout(timer)
        resolve(event)
      }
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter)
        reject(new Error(`No server-sent event received in ${timeoutMs}ms`))
      }, timeoutMs)
      this.waiters.push(waiter)
    })
  }

  /**
   * Resolve with the next event for which `predicate` returns true, skipping
   * other events, or reject after `timeoutMs`
   */
  async nextEventMatching(
    predicate: (event: ServerSentEvent) => boolean,
    timeoutMs = 5000,
  ): Promise<ServerSentEvent> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        throw new Error(`No matching server-sent event in ${timeoutMs}ms`)
      }
      const event = await this.nextEvent(remaining)
      if (predicate(event)) {
        return event
      }
    }
  }

  /**
   * Resolve with the next event of the given type, skipping other events, or
   * reject after `timeoutMs`
   */
  nextEventOfType(type: string, timeoutMs = 5000): Promise<ServerSentEvent> {
    return this.nextEventMatching((event) => event.type === type, timeoutMs)
  }

  /** Close the connection */
  async close() {
    this.controller.abort()
    await this.reading
  }
}
