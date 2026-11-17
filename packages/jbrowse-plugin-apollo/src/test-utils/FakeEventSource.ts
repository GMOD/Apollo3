/**
 * A minimal stand-in for the browser's `EventSource`, which isn't available in
 * the Jest node environment. Tests call `emit()` to simulate the server
 * sending an event.
 */
export class FakeEventSource extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2

  /** Every instance created, most recent last */
  static instances: FakeEventSource[] = []

  readonly url: string
  readonly withCredentials = false
  readyState = FakeEventSource.CONNECTING

  constructor(url: string | URL) {
    super()
    this.url = url.toString()
    FakeEventSource.instances.push(this)
  }

  /** Simulate the connection opening */
  open() {
    this.readyState = FakeEventSource.OPEN
    this.dispatchEvent(new Event('open'))
  }

  /** Simulate a connection error */
  error() {
    this.dispatchEvent(new Event('error'))
  }

  /** Simulate the server sending an event, with `data` serialized as JSON */
  emit(type: string, data: unknown) {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }))
  }

  close() {
    this.readyState = FakeEventSource.CLOSED
  }
}

function base64urlJSON(obj: object) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

/** Make an unsigned JWT that `jwt-decode` can read */
export function makeFakeToken(payload: Record<string, unknown>) {
  return `${base64urlJSON({ alg: 'none', typ: 'JWT' })}.${base64urlJSON(payload)}.signature`
}
