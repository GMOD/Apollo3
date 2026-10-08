/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
  ApolloServerHookMap,
  ApolloServerHookName,
  PluginRouteContext,
  ServerChangeContext,
} from '@apollo-annotation/common/server'
import type { Request, Response } from 'express'

import { ExampleNotesChange } from '../shared/ExampleNotesChange.js'

import ApolloExampleServerPlugin, {
  applyNotesChange,
  notesRoute,
} from './index.js'

/** Runs the plugin's install() and returns what each hook contributes */
function installPlugin() {
  const hooks = new Map<
    string,
    (extendee: unknown, props: unknown) => unknown
  >()
  new ApolloExampleServerPlugin().install({
    registerHook<Name extends ApolloServerHookName>(
      name: Name,
      callback: ApolloServerHookMap[Name],
    ) {
      hooks.set(
        name,
        callback as (extendee: unknown, props: unknown) => unknown,
      )
    },
  })
  return hooks
}

/** A stored gene with an mRNA child, and a fake Feature model holding it */
function makeConnection() {
  const mrna = {
    _id: 'mrna1',
    refSeq: 'refSeq1',
    attributes: new Map([['note', ['old']]]),
  }
  const gene = {
    _id: 'gene1',
    refSeq: 'refSeq1',
    attributes: new Map<string, string[]>(),
    children: new Map([['mrna1', mrna]]),
    modified: [] as string[],
    saved: false,
    markModified(path: string) {
      gene.modified.push(path)
    },
    save() {
      gene.saved = true
      return Promise.resolve()
    },
  }
  const query = {
    session: () => query,
    exec: () => Promise.resolve(gene),
  }
  const connection = {
    model: (name: string) =>
      name === 'Feature'
        ? { findOne: () => query }
        : {
            findById: () => ({
              exec: () => Promise.resolve({ assembly: 'assembly1' }),
            }),
          },
  }
  return { connection, gene, mrna }
}

describe('ApolloExampleServerPlugin', () => {
  it('contributes a change type, check, rule and route', () => {
    const hooks = installPlugin()
    const changeTypes = hooks.get('Apollo-RegisterChangeTypes')?.({}, {}) as
      | Record<string, unknown>
      | undefined
    assert.ok(changeTypes?.ExampleNotesChange)
    const checks = hooks.get('Apollo-RegisterChecks')?.([], {}) as unknown[]
    assert.equal(checks.length, 1)
    const validations = hooks.get('Apollo-RegisterValidations')?.(
      [],
      {},
    ) as unknown[]
    assert.equal(validations.length, 1)
    const routes = hooks.get('Apollo-RegisterRoutes')?.([], {}) as unknown[]
    assert.deepEqual(routes, [notesRoute])
  })

  it('applies a notes change to a child feature', async () => {
    const { connection, gene, mrna } = makeConnection()
    const change = new ExampleNotesChange({
      typeName: 'ExampleNotesChange',
      assembly: 'assembly1',
      changedIds: ['mrna1'],
      featureId: 'mrna1',
      oldNotes: ['old'],
      newNotes: ['new'],
    })

    await applyNotesChange(change, {
      connection,
      session: {},
    } as unknown as ServerChangeContext)

    assert.deepEqual(mrna.attributes, { note: ['new'] })
    assert.deepEqual(gene.modified, ['children'])
    assert.equal(gene.saved, true)
  })

  it("serves a feature's notes, respecting assembly access", async () => {
    const { connection } = makeConnection()
    const respond = async (allowedAssemblyIds?: string[]) => {
      let status = 200
      let body: unknown
      const res = {
        status(code: number) {
          status = code
          return res
        },
        end() {
          // no body
        },
        json(value: unknown) {
          body = value
        },
      }
      await notesRoute.handler(
        {} as Request,
        res as unknown as Response,
        {
          params: { featureId: 'mrna1' },
          allowedAssemblyIds,
          connection,
        } as unknown as PluginRouteContext,
      )
      return { status, body }
    }

    assert.deepEqual(await respond(), {
      status: 200,
      body: { featureId: 'mrna1', notes: ['old'] },
    })
    const allowed = await respond(['assembly1'])
    assert.equal(allowed.status, 200)
    const notAllowed = await respond(['otherAssembly'])
    assert.equal(notAllowed.status, 404)
  })
})
