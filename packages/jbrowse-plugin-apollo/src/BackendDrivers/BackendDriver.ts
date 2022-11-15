import { Region } from '@jbrowse/core/util'
import { AnnotationFeatureSnapshot } from 'apollo-mst'
import {
  Change,
  ClientDataStore,
  SubmitOpts,
  ValidationResultSet,
} from 'apollo-shared'

export abstract class BackendDriver {
  constructor(protected clientStore: ClientDataStore) {}

  abstract getFeatures(region: Region): Promise<AnnotationFeatureSnapshot[]>

  abstract getSequence(region: Region): Promise<string>

  abstract getRefSeqs(): Promise<string[]>

  abstract submitChange(
    change: Change,
    opts: SubmitOpts,
  ): Promise<ValidationResultSet>
}
