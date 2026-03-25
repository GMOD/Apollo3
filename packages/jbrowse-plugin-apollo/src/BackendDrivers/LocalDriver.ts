/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
import type { Change } from '@apollo-annotation/common'
import type {
  AnnotationFeatureSnapshot,
  CheckResultSnapshot,
} from '@apollo-annotation/mst'
import { ValidationResultSet } from '@apollo-annotation/shared'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Region } from '@jbrowse/core/util'

import type { SubmitOpts } from '../ChangeManager'

import { BackendDriver, type RefNameAliases } from './BackendDriver'

export class LocalDriver extends BackendDriver {
  async getFeatures(
    region: Region,
  ): Promise<[AnnotationFeatureSnapshot[], CheckResultSnapshot[]]> {
    return [[], []]
  }

  async getSequence(region: Region): Promise<{ seq: string; refSeq: string }> {
    return { seq: '', refSeq: '' }
  }

  async getRegions(assemblyName: string): Promise<Region[]> {
    return []
  }

  getAssemblies(internetAccountConfigId?: string): Assembly[] {
    return []
  }

  async getRefNameAliases(assemblyName: string): Promise<RefNameAliases[]> {
    return []
  }

  async submitChange(
    change: Change,
    opts: SubmitOpts,
  ): Promise<ValidationResultSet> {
    return new ValidationResultSet()
  }

  async searchFeatures(
    term: string,
    assemblies: string[],
  ): Promise<AnnotationFeatureSnapshot[]> {
    return []
  }
}
