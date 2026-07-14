import { TransformStream } from 'node:stream/web'

import type { FeatureDocument } from '@apollo-annotation/schemas'

import type { ChecksService } from '../checks/checks.service.js'

export class CheckFeatureStream extends TransformStream<
  FeatureDocument,
  FeatureDocument
> {
  constructor(checksService: ChecksService) {
    super({
      async transform(chunk, controller) {
        try {
          await checksService.checkFeature(chunk)
          controller.enqueue(chunk)
        } catch (error) {
          controller.error(
            error instanceof Error ? error : new Error(String(error)),
          )
        }
      },
    })
  }
}

export class DocToJSONArrayStream<T> extends TransformStream<T, string> {
  constructor() {
    let isFirst = true
    super({
      start(controller) {
        controller.enqueue('[')
      },
      transform(chunk, controller) {
        controller.enqueue((isFirst ? '' : ',') + JSON.stringify(chunk))
        isFirst = false
      },
      flush(controller) {
        controller.enqueue(']')
      },
    })
  }
}
