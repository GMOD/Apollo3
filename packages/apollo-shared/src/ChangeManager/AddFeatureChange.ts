import gff, { GFF3Feature, GFF3FeatureLine } from '@gmod/gff'
import { resolveIdentifier } from 'mobx-state-tree'
import { v4 as uuidv4 } from 'uuid'

import { AnnotationFeatureLocation } from '../BackendDrivers/AnnotationFeature'
import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'
import { FeatureChange } from './FeatureChange'
import { DeleteFeatureChange } from '..'

interface SerializedAddFeatureChangeBase extends SerializedChange {
  typeName: 'AddFeatureChange'
}

export interface AddFeatureChangeDetails {
  stringOfGFF3: string
}

interface SerializedAddFeatureChangeSingle
  extends SerializedAddFeatureChangeBase,
    AddFeatureChangeDetails {}

interface SerializedAddFeatureChangeMultiple
  extends SerializedAddFeatureChangeBase {
  changes: AddFeatureChangeDetails[]
}

type SerializedAddFeatureChange =
  | SerializedAddFeatureChangeSingle
  | SerializedAddFeatureChangeMultiple

export class AddFeatureChange extends FeatureChange {
  typeName = 'AddFeatureChange' as const
  changes: AddFeatureChangeDetails[]

  constructor(json: SerializedAddFeatureChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedAddFeatureChange {
    if (this.changes.length === 1) {
      const [{ stringOfGFF3 }] = this.changes
      return {
        typeName: this.typeName,
        changedIds: this.changedIds,
        assemblyId: this.assemblyId,
        stringOfGFF3,
      }
    }
    return {
      typeName: this.typeName,
      changedIds: this.changedIds,
      assemblyId: this.assemblyId,
      changes: this.changes,
    }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToServer(backend: ServerDataStore) {
    const { assemblyModel } = backend
    const { changes, assemblyId } = this

    let cnt = 0
    // Loop the changes
    for (const change of changes) {
      const { stringOfGFF3 } = change
      const assembly = await assemblyModel.findById(assemblyId).exec()
      if (!assembly) {
        const errMsg = `*** ERROR: Assembly with id "${assemblyId}" not found`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }

      const gff3Items = gff.parseStringSync(stringOfGFF3, {
        parseSequences: false,
      })
      for (const gff3Item of gff3Items) {
        if (Array.isArray(gff3Item)) {
          // gff3Item is a GFF3Feature
          this.logger.debug?.(`GFF3ITEM: ${JSON.stringify(gff3Item)}`)
          // Add new feature into database
          await this.addFeatureIntoDb(gff3Item, backend)
          cnt++
        }
      }
    }
    this.logger.debug?.(`Added ${cnt} new feature(s) into database.`)
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  async applyToClient(dataStore: ClientDataStore) {
    if (!dataStore) {
      throw new Error('No data store')
    }
    this.changedIds.forEach((changedId, idx) => {
      const feature = resolveIdentifier(
        AnnotationFeatureLocation,
        dataStore.features,
        changedId,
      )
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
    })
  }

  getInverse() {
    const inverseChangedIds = this.changedIds.slice().reverse()
    const inverseChanges = this.changes
      .slice()
      .reverse()
      .map((endChange) => ({
        featureId: endChange.stringOfGFF3,
        assemblyId: endChange.stringOfGFF3,
      }))
    return new DeleteFeatureChange(
      {
        changedIds: inverseChangedIds,
        typeName: 'DeleteFeatureChange',
        changes: inverseChanges,
        assemblyId: this.assemblyId,
      },
      { logger: this.logger },
    )
  }
}

export function isAddFeatureChange(
  change: unknown,
): change is AddFeatureChange {
  return (change as AddFeatureChange).typeName === 'AddFeatureChange'
}
