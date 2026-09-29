import { describe, expect, it, jest } from '@jest/globals'

import { FakeEventSource } from '../test-utils/FakeEventSource'

import { ChannelSubscriptions } from './ChannelSubscriptions'

function asEventSource(fake: FakeEventSource) {
  return fake as unknown as EventSource
}

describe('ChannelSubscriptions', () => {
  it('delivers events to a listener subscribed after attaching', () => {
    const subscriptions = new ChannelSubscriptions()
    const eventSource = new FakeEventSource('http://localhost/events')
    subscriptions.attach(asEventSource(eventSource))
    const listener = jest.fn()
    subscriptions.subscribe('asm1-ctgA', listener)
    eventSource.emit('asm1-ctgA', { n: 1 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('delivers events to a listener subscribed before attaching', () => {
    const subscriptions = new ChannelSubscriptions()
    const listener = jest.fn()
    expect(subscriptions.subscribe('asm1-ctgA', listener)).toBe(true)
    const eventSource = new FakeEventSource('http://localhost/events')
    subscriptions.attach(asEventSource(eventSource))
    eventSource.emit('asm1-ctgA', { n: 1 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps only the first listener for a channel', () => {
    const subscriptions = new ChannelSubscriptions()
    const eventSource = new FakeEventSource('http://localhost/events')
    subscriptions.attach(asEventSource(eventSource))
    const first = jest.fn()
    const second = jest.fn()
    expect(subscriptions.subscribe('asm1-ctgA', first)).toBe(true)
    expect(subscriptions.subscribe('asm1-ctgA', second)).toBe(false)
    eventSource.emit('asm1-ctgA', { n: 1 })
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })

  it('moves listeners to a new event source', () => {
    const subscriptions = new ChannelSubscriptions()
    const listener = jest.fn()
    subscriptions.subscribe('asm1-ctgA', listener)
    const oldSource = new FakeEventSource('http://localhost/events')
    const newSource = new FakeEventSource('http://localhost/events')
    subscriptions.attach(asEventSource(oldSource))
    subscriptions.attach(asEventSource(newSource))
    oldSource.emit('asm1-ctgA', { n: 1 })
    expect(listener).not.toHaveBeenCalled()
    newSource.emit('asm1-ctgA', { n: 2 })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
