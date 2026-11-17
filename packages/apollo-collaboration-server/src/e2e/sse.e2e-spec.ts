/**
 * End-to-end tests for server-sent events. These run against an
 * already-running server (see `test:cli:start`), configured with:
 * - APOLLO_URL (default http://localhost:3999)
 * - APOLLO_ROOT_PASSWORD (default "pass")
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  type ChangeMessage,
  type RequestUserInformationMessage,
  type UserLocationMessage,
  makeUserSessionId,
} from '@apollo-annotation/shared'
import { Types } from 'mongoose'

import { SSEClient } from '../test-utils/sseClient.js'

const baseURL = process.env.APOLLO_URL ?? 'http://localhost:3999'
const rootPassword = process.env.APOLLO_ROOT_PASSWORD ?? 'pass'
const testDataDir = path.resolve('test', 'data')

function url(endpoint: string) {
  return new URL(endpoint, baseURL.endsWith('/') ? baseURL : `${baseURL}/`)
}

async function apiFetch(
  endpoint: string,
  token: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(url(endpoint), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  })
  if (!response.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${endpoint} failed: ${response.status} ${await response.text()}`,
    )
  }
  const text = await response.text()
  return text ? (JSON.parse(text) as unknown) : undefined
}

function postJSON(endpoint: string, token: string, body: unknown) {
  return apiFetch(endpoint, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

let lastLoginTime = 0

/**
 * Log in as the root user. Session IDs are made from the user ID and the
 * token's issued-at time (in seconds), so wait until the next second between
 * logins to make sure each login is a distinct session.
 */
async function login(): Promise<string> {
  const nextSecond = (Math.floor(lastLoginTime / 1000) + 1) * 1000
  const wait = nextSecond - Date.now()
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
  lastLoginTime = Date.now()
  const { token } = (await postJSON('auth/root', '', {
    password: rootPassword,
  })) as { token: string }
  return token
}

const clients: SSEClient[] = []

async function connectStatus(client: SSEClient) {
  clients.push(client)
  const response = await client.connect()
  return response.status
}

describe('Server-sent events (e2e)', () => {
  let token: string

  async function openStream(streamToken = token) {
    const eventsURL = url('messages/events')
    eventsURL.searchParams.set('token', streamToken)
    const client = new SSEClient(eventsURL)
    clients.push(client)
    const response = await client.connect()
    expect(response.status).toBe(200)
    return client
  }

  beforeAll(async () => {
    token = await login()
  })

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.close()))
    clients.length = 0
  })

  describe('authentication', () => {
    it('rejects a connection without a token', async () => {
      await expect(
        connectStatus(new SSEClient(url('messages/events'))),
      ).resolves.toBe(403)
    })

    it('rejects a connection with an invalid token', async () => {
      const eventsURL = url('messages/events')
      eventsURL.searchParams.set('token', 'not-a-valid-token')
      await expect(connectStatus(new SSEClient(eventsURL))).resolves.toBe(403)
    })

    it('accepts a token in the "token" query parameter', async () => {
      const client = await openStream()
      expect(client.response?.headers.get('content-type')).toMatch(
        /^text\/event-stream/,
      )
    })

    it('accepts a token in the Authorization header', async () => {
      const client = new SSEClient(url('messages/events'), {
        Authorization: `Bearer ${token}`,
      })
      await expect(connectStatus(client)).resolves.toBe(200)
    })
  })

  describe('user locations', () => {
    it('broadcasts REQUEST_INFORMATION when a user requests locations', async () => {
      const client = await openStream()
      await apiFetch('users/locations', token)
      const event = await client.nextEventOfType('REQUEST_INFORMATION')
      const message = JSON.parse(event.data) as RequestUserInformationMessage
      expect(message).toMatchObject({
        channel: 'REQUEST_INFORMATION',
        reqType: 'CURRENT_LOCATION',
        userSessionId: makeUserSessionId(token),
      })
    })

    it('broadcasts USER_LOCATION when a user posts their location', async () => {
      const client = await openStream()
      const locations = [
        { assemblyId: 'asm1', refSeq: 'ctgA', start: 10, end: 20 },
      ]
      await postJSON('users/userLocation', token, locations)
      const event = await client.nextEventOfType('USER_LOCATION')
      const message = JSON.parse(event.data) as UserLocationMessage
      expect(message).toMatchObject({
        channel: 'USER_LOCATION',
        userSessionId: makeUserSessionId(token),
        locations,
      })
    })

    it('accepts locations in the legacy form-encoded format', async () => {
      const client = await openStream()
      const locations = [
        { assemblyId: 'asm1', refSeq: 'ctgA', start: 30, end: 40 },
      ]
      await apiFetch('users/userLocation', token, {
        method: 'POST',
        body: new URLSearchParams(JSON.stringify(locations)),
      })
      const event = await client.nextEventOfType('USER_LOCATION')
      const message = JSON.parse(event.data) as UserLocationMessage
      expect(message.locations).toEqual(locations)
    })

    it('delivers each broadcast to every open stream', async () => {
      const first = await openStream()
      const second = await openStream(await login())
      await apiFetch('users/locations', token)
      const [firstEvent, secondEvent] = await Promise.all([
        first.nextEventOfType('REQUEST_INFORMATION'),
        second.nextEventOfType('REQUEST_INFORMATION'),
      ])
      expect(firstEvent.data).toEqual(secondEvent.data)
    })
  })

  describe('changes', () => {
    const assemblyId = new Types.ObjectId().toHexString()
    let assemblyAdded = false

    afterAll(async () => {
      if (assemblyAdded) {
        await postJSON('changes', token, {
          typeName: 'DeleteAssemblyChange',
          assembly: assemblyId,
        })
      }
    })

    it('broadcasts assembly changes on COMMON to other sessions', async () => {
      const listener = await openStream(await login())

      const gff3 = await fs.readFile(path.join(testDataDir, 'tiny.fasta.gff3'))
      const searchParams = new URLSearchParams({
        name: 'tiny.fasta.gff3',
        type: 'text/x-gff3',
      })
      const file = (await apiFetch(`files?${searchParams.toString()}`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'text/x-gff3' },
        body: gff3,
      })) as { _id: string }
      await postJSON('changes', token, {
        typeName: 'AddAssemblyAndFeaturesFromFileChange',
        assembly: assemblyId,
        assemblyName: `sse-e2e-${assemblyId}`,
        fileIds: { fa: file._id },
        parseOptions: { strict: true },
      })
      assemblyAdded = true

      // Check results are also broadcast on COMMON, so skip those
      const event = await listener.nextEventMatching(
        ({ data, type }) => type === 'COMMON' && data.includes('"changeInfo"'),
        15_000,
      )
      const message = JSON.parse(event.data) as ChangeMessage
      expect(message.channel).toBe('COMMON')
      expect(message.userSessionId).toBe(makeUserSessionId(token))
      expect(message.changeSequence).toEqual(expect.any(Number))
      expect(message.changeInfo).toMatchObject({
        typeName: 'AddAssemblyAndFeaturesFromFileChange',
        assembly: assemblyId,
      })
    })

    it('broadcasts feature changes on the "<assembly>-<refSeq>" channel', async () => {
      expect(assemblyAdded).toBe(true)
      const listener = await openStream(await login())

      const [gene] = (await apiFetch(
        `features/searchFeatures?term=EDEN&assemblies=${assemblyId}`,
        token,
      )) as { _id: string; max: number }[]
      if (!gene) {
        throw new Error('Feature "EDEN" not found')
      }
      const change = {
        typeName: 'LocationEndChange',
        assembly: assemblyId,
        changedIds: [gene._id],
        featureId: gene._id,
        oldEnd: gene.max,
        newEnd: gene.max + 10,
      }
      await postJSON('changes', token, change)

      const channel = `${assemblyId}-ctgA`
      const event = await listener.nextEventOfType(channel)
      const message = JSON.parse(event.data) as ChangeMessage
      expect(message).toMatchObject({
        channel,
        userSessionId: makeUserSessionId(token),
        changeInfo: change,
      })
      expect(message.changeSequence).toEqual(expect.any(Number))
    })
  })
})
