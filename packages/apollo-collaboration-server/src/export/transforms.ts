/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { TransformStream } from 'node:stream/web'

import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import type {
  FeatureDocument,
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

interface SequenceAdapter {
  getSequence(
    name: string,
    start: number,
    end: number,
  ): Promise<string | undefined>
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

/**
 * Streams FASTA text for a sequence of RefSeq documents, fetching each
 * refSeq's full sequence from a JBrowse config.json-backed sequence
 * adapter (see JBrowseConfigService.getSequenceAdapterForAssembly).
 */
export class RefSeqDocToAdapterFASTAStream extends TransformStream<
  RefSeqDocument,
  string
> {
  constructor(sequenceAdapter: SequenceAdapter, opts?: FastaTransformOptions) {
    const { fastaWidth = 80 } = opts ?? {}
    super({
      start(controller) {
        controller.enqueue('##FASTA\n')
      },
      async transform(refSeqDoc, controller) {
        controller.enqueue(`>${refSeqDoc.name}\n`)
        const sequence = await sequenceAdapter.getSequence(
          refSeqDoc.name,
          0,
          refSeqDoc.length,
        )
        if (sequence === undefined) {
          controller.error(
            new Error(`Sequence not found for refSeq "${refSeqDoc.name}"`),
          )
          return
        }
        const seqLines = splitStringIntoChunks(sequence, fastaWidth)
        if (seqLines.length > 0) {
          controller.enqueue(`${seqLines.join('\n')}\n`)
        }
      },
    })
  }
}
