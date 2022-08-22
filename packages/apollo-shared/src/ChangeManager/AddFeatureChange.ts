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
  newFeatureIds: string[]
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
      const [{ stringOfGFF3, newFeatureIds }] = this.changes
      return {
        typeName: this.typeName,
        changedIds: this.changedIds,
        assemblyId: this.assemblyId,
        stringOfGFF3,
        newFeatureIds,
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
    const { assemblyModel, session } = backend
    const { changes, assemblyId } = this

    const assembly = await assemblyModel
      .findById(assemblyId)
      .session(session)
      .exec()
    if (!assembly) {
      const errMsg = `*** ERROR: Assembly with id "${assemblyId}" not found`
      this.logger.error(errMsg)
      throw new Error(errMsg)
    }

    let featureCnt = 0
    // Loop the changes
    for (const change of changes) {
      const { stringOfGFF3 } = change
      const gff3Items = gff.parseStringSync(stringOfGFF3, {
        parseSequences: false,
      })
      // Loop features
      for (const gff3Item of gff3Items) {
        if (Array.isArray(gff3Item)) {
          this.logger.debug?.(`GFF3ITEM: ${JSON.stringify(gff3Item)}`)
          // Add new feature into database
          const newDocIdArray = await this.addFeatureIntoDb(gff3Item, backend)
          this.logger.debug?.(
            `** New added feature docId: "${newDocIdArray}" that contains the following featureIds: "${newDocIdArray}"`,
          )
          newDocIdArray.forEach((element) => {
            change.newFeatureIds.push(element) // Add new feature id into change.newFeatureIds -array
          })

          featureCnt++
        }
      }
    }
    this.logger.debug?.(`Added ${featureCnt} new feature(s) into database.`)
    this.getInverse()
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
      .map((addFeatChange) =>
       ({
        featureId: addFeatChange.newFeatureIds.toString(),
      }))
    this.logger.debug?.(`INVERSE: "${JSON.stringify(inverseChanges)}"`)
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
