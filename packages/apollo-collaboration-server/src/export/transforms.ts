/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { TransformStream } from 'node:stream/web'

import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import type {
  FeatureDocument,
  RefSeqChunkDocument,
  RefSeqDocument,
} from '@apollo-annotation/schemas'
import {
  annotationFeatureToGFF3,
  splitStringIntoChunks,
} from '@apollo-annotation/shared'
import type { GFF3Feature } from '@gmod/gff'

interface FastaTransformOptions {
  fastaWidth?: number
}

function makeFastaHeader(refSeqDoc: {
  description: string
  name: string
}): string {
  const refSeqDescription = refSeqDoc.description
    ? ` ${refSeqDoc.description}`
    : ''
  return `>${refSeqDoc.name}${refSeqDescription}\n`
}

export class FeatureDocToGFF3FeatureStream extends TransformStream<
  FeatureDocument,
  GFF3Feature
> {
  constructor(refSeqs: RefSeqDocument[]) {
    super({
      start() {
        // intentionally empty
      },
      transform(chunk: FeatureDocument, controller) {
        try {
          const flattened = chunk.toObject({ flattenMaps: true })
          const refSeqNames = Object.fromEntries(
            refSeqs.map((refSeq) => [refSeq._id, refSeq.name]),
          )
          const gff3Feature = annotationFeatureToGFF3(
            flattened as unknown as AnnotationFeatureSnapshot,
            undefined,
            refSeqNames,
          )
          controller.enqueue(gff3Feature)
        } catch (error) {
          controller.error(
            error instanceof Error ? error : new Error(String(error)),
          )
        }
      },
    })
  }
}

export class RefSeqDocToGFF3HeaderStream extends TransformStream<
  RefSeqDocument,
  string
> {
  constructor() {
    super({
      start(controller) {
        controller.enqueue('##gff-version 3\n')
      },
      transform(chunk, controller) {
        controller.enqueue(
          `##sequence-region ${chunk.name} 1 ${chunk.length}\n`,
        )
      },
    })
  }
}

export class RefSeqChunkDocToFASTAStream extends TransformStream<
  RefSeqChunkDocument,
  string
> {
  constructor(opts?: FastaTransformOptions) {
    let lineBuffer = ''
    let currentRefSeq: string | undefined
    const { fastaWidth = 80 } = opts ?? {}
    const flushLineBuffer = (
      controller: TransformStreamDefaultController<string>,
    ) => {
      if (lineBuffer) {
        controller.enqueue(`${lineBuffer}\n`)
        lineBuffer = ''
      }
    }
    super({
      start(controller) {
        controller.enqueue('##FASTA\n')
      },
      transform(chunk, controller) {
        const refSeqDoc = chunk.refSeq
        const refSeqDocId = refSeqDoc._id.toString()
        if (refSeqDocId !== currentRefSeq) {
          flushLineBuffer(controller)
          controller.enqueue(makeFastaHeader(refSeqDoc))
          currentRefSeq = refSeqDocId
        }
        let { sequence } = chunk
        if (lineBuffer) {
          const neededLength = fastaWidth - lineBuffer.length
          const bufferFiller = sequence.slice(0, neededLength)
          sequence = sequence.slice(neededLength)
          lineBuffer += bufferFiller
          if (lineBuffer.length === fastaWidth) {
            flushLineBuffer(controller)
          } else {
            return
          }
        }
        const seqLines = splitStringIntoChunks(sequence, fastaWidth)
        const lastLine = seqLines.at(-1) ?? ''
        if (lastLine.length > 0 && lastLine.length !== fastaWidth) {
          lineBuffer = seqLines.pop() ?? ''
        }
        if (seqLines.length > 0) {
          controller.enqueue(`${seqLines.join('\n')}\n`)
        }
      },
      flush(controller) {
        flushLineBuffer(controller)
      },
    })
  }
}
