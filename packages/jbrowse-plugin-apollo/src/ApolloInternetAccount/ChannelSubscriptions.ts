export type ChannelListener = (event: MessageEvent<string>) => void

/**
 * Keeps track of listeners for server-sent event channels, so they can be
 * registered before the `EventSource` exists and are attached once it does.
 */
export class ChannelSubscriptions {
  private readonly listeners = new Map<string, ChannelListener>()
  private eventSource: EventSource | undefined

  /**
   * Listen for events on a channel. Only the first listener for a channel is
   * kept; later calls for the same channel are ignored.
   * @returns whether the listener was added
   */
  subscribe(channel: string, listener: ChannelListener) {
    if (this.listeners.has(channel)) {
      return false
    }
    this.listeners.set(channel, listener)
    this.eventSource?.addEventListener(channel, listener)
    return true
  }

  /**
   * Attach all current and future listeners to `eventSource`, moving them off
   * any previously attached event source
   */
  attach(eventSource: EventSource) {
    for (const [channel, listener] of this.listeners) {
      this.eventSource?.removeEventListener(channel, listener)
      eventSource.addEventListener(channel, listener)
    }
    this.eventSource = eventSource
  }
}
