/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ExampleNoteLengthRule,
  MAX_NOTE_LENGTH,
} from './ExampleNoteLengthRule.js'
import { ExampleNotesChange } from './ExampleNotesChange.js'
import { ExampleShortFeatureCheck } from './ExampleShortFeatureCheck.js'

function makeChange(newNotes: string[]) {
  return new ExampleNotesChange({
    typeName: 'ExampleNotesChange',
    assembly: 'assembly1',
    changedIds: ['feature1'],
    featureId: 'feature1',
    oldNotes: ['old'],
    newNotes,
  })
}

function makeAttributeChange(
  oldAttributes: Record<string, string[]>,
  newAttributes: Record<string, string[]>,
) {
  return {
    typeName: 'FeatureAttributeChange',
    changes: [{ featureId: 'feature1', oldAttributes, newAttributes }],
  } as never
}

describe('ExampleNotesChange', () => {
  it('round-trips through JSON and inverts', () => {
    const change = makeChange(['new'])
    assert.deepEqual(new ExampleNotesChange(change.toJSON()), change)
    const inverse = change.getInverse()
    assert.deepEqual(inverse.oldNotes, ['new'])
    assert.deepEqual(inverse.newNotes, ['old'])
  })
})

describe('ExampleNoteLengthRule', () => {
  const rule = new ExampleNoteLengthRule()
  it('allows short notes', () => {
    assert.equal(rule.validate(makeChange(['fine'])), undefined)
  })
  it('rejects long notes', () => {
    assert.match(
      String(rule.validate(makeChange(['x'.repeat(MAX_NOTE_LENGTH + 1)]))),
      /at most/,
    )
  })
  it('allows long notes the feature already had', () => {
    const longNote = 'x'.repeat(MAX_NOTE_LENGTH + 1)
    const change = makeChange([longNote, 'new'])
    change.oldNotes = [longNote]
    assert.equal(rule.validate(change), undefined)
  })
  it('checks notes set with a FeatureAttributeChange', () => {
    const longNote = 'x'.repeat(MAX_NOTE_LENGTH + 1)
    assert.equal(
      rule.validate(makeAttributeChange({}, { note: ['fine'], gene: ['abc'] })),
      undefined,
    )
    assert.match(
      String(rule.validate(makeAttributeChange({}, { note: [longNote] }))),
      /at most/,
    )
    assert.equal(
      rule.validate(
        makeAttributeChange(
          { note: [longNote] },
          { note: [longNote], gene: ['abc'] },
        ),
      ),
      undefined,
    )
  })
})

describe('ExampleShortFeatureCheck', () => {
  it('flags short features at any level', async () => {
    const results = await new ExampleShortFeatureCheck().checkFeature({
      _id: 'gene1',
      refSeq: 'refSeq1',
      type: 'gene',
      min: 0,
      max: 100,
      children: {
        exon1: {
          _id: 'exon1',
          refSeq: 'refSeq1',
          type: 'exon',
          min: 10,
          max: 12,
        },
      },
    })
    const [result] = results
    assert.equal(results.length, 1)
    assert.ok(result)
    assert.deepEqual(result.ids, ['exon1'])
    assert.match(result._id, /^[\da-f]{24}$/)
  })
})
