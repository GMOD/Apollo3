/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { AddFeatureChange } from '@apollo-annotation/shared'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import PluggableElementBase from '@jbrowse/core/pluggableElementTypes/PluggableElementBase'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import AddIcon from '@mui/icons-material/Add'
import ObjectID from 'bson-objectid'

import { ApolloSessionModel } from '../session'

function parseCigar(cigar: string): [string | undefined, number][] {
  return (cigar.toUpperCase().match(/\d+\D/g) ?? []).map((op) => {
    return [(/\D/.exec(op) ?? [])[0], Number.parseInt(op, 10)]
  })
}

export function annotationFromPileup(pluggableElement: PluggableElementBase) {
  if (pluggableElement.name !== 'LinearPileupDisplay') {
    return pluggableElement
  }
  const { stateModel } = pluggableElement as DisplayType
  const newStateModel = stateModel
    .views((self) => ({
      getFirstRegion() {
        const lgv = getContainingView(self) as unknown as LinearGenomeViewModel
        return lgv.dynamicBlocks.contentBlocks[0]
      },
      getAssembly() {
        const firstRegion = self.getFirstRegion()
        const session = getSession(self)
        const { assemblyManager } = session
        const { assemblyName } = firstRegion
        const assembly = assemblyManager.get(assemblyName)
        if (!assembly) {
          throw new Error(`Could not find assembly named ${assemblyName}`)
        }
        return assembly
      },
      getRefSeqId(assembly: Assembly) {
        const firstRegion = self.getFirstRegion()
        const { refName } = firstRegion
        const { refNameAliases } = assembly
        if (!refNameAliases) {
          throw new Error(`Could not find aliases for ${assembly.name}`)
        }
        const newRefNames = [...Object.entries(refNameAliases)]
          .filter(([id, refName]) => id !== refName)
          .map(([id, refName]) => ({
            _id: id,
            name: refName,
          }))
        const refSeqId = newRefNames.find((item) => item.name === refName)?._id
        if (!refSeqId) {
          throw new Error(`Could not find refSeqId named ${refName}`)
        }
        return refSeqId
      },
      createFeature() {
        const feature = self.contextMenuFeature
        const assembly = self.getAssembly()
        const refSeqId = self.getRefSeqId(assembly)
        const cigarData: string = feature.get('CIGAR')
        const ops = parseCigar(cigarData)
        let currOffset = 0
        const start: number = feature.get('start')
        let openStart: number | undefined
        const exons: {
          start: number
          end: number
        }[] = []
        for (const [op, len] of ops) {
          // open or continue open
          if (op === 'M' || op === '=') {
            // if it was closed, then open with start, strand, type
            if (openStart === undefined) {
              // add subfeature
              openStart = currOffset + start
            }
          } else if (op === 'N' && openStart !== undefined) {
            // if it was open, then close and add the subfeature
            exons.push({
              start: openStart,
              end: currOffset + openStart,
            })
            openStart = undefined
          }
          if (op !== 'I') {
            // we ignore insertions when calculating potential exon length
            currOffset += len
          }
        }
        // if we are still open, then close with the final length and add subfeature
        if (openStart !== undefined) {
          exons.push({
            start: openStart,
            end: currOffset + start,
          })
        }

        const newFeature: AnnotationFeatureSnapshot = {
          _id: ObjectID().toHexString(),
          refSeq: refSeqId,
          min: feature.get('start'),
          max: feature.get('end'),
          type: 'mRNA',
          strand: feature.get('strand'),
        }
        if (exons.length === 0) {
          return newFeature
        }

        const children: Record<string, AnnotationFeatureSnapshot> = {}
        newFeature.children = children
        const [firstExon] = exons
        const cdsFeature: AnnotationFeatureSnapshot = {
          _id: ObjectID().toHexString(),
          refSeq: refSeqId,
          min: firstExon.start,
          max: firstExon.end,
          type: 'CDS',
          strand: feature.get('strand'),
        }
        newFeature.children[cdsFeature._id] = cdsFeature
        if (exons.length === 1) {
          const exon: AnnotationFeatureSnapshot = {
            _id: ObjectID().toHexString(),
            refSeq: refSeqId,
            min: firstExon.start,
            max: firstExon.end,
            type: 'exon',
            strand: feature.get('strand'),
          }
          newFeature.children[exon._id] = exon
          return newFeature
        }

        const discontinuousLocations: {
          start: number
          end: number
          phase: 0 | 1 | 2
        }[] = []
        let phase: 0 | 1 | 2 = 0
        for (const exon of exons) {
          cdsFeature.min = Math.min(cdsFeature.min, exon.start)
          cdsFeature.max = Math.max(cdsFeature.max, exon.end)
          const { end, start } = exon
          discontinuousLocations.push({ start, end, phase })
          const localPhase = (end - start) % 3
          phase = ((phase + localPhase) % 3) as 0 | 1 | 2
          const newExon: AnnotationFeatureSnapshot = {
            _id: ObjectID().toHexString(),
            refSeq: refSeqId,
            min: start,
            max: end,
            type: 'exon',
            strand: feature.get('strand'),
          }
          newFeature.children[newExon._id] = newExon
        }
        return newFeature
      },
      async onPileupFeatureContext() {
        const newFeature = self.createFeature()
        const assembly = self.getAssembly()
        const assemblyId = assembly.name
        const change = new AddFeatureChange({
          changedIds: [newFeature._id],
          typeName: 'AddFeatureChange',
          assembly: assemblyId,
          addedFeature: newFeature,
        })
        const session = getSession(self)
        await (
          session as unknown as ApolloSessionModel
        ).apolloDataStore.changeManager.submit(change)
        session.notify('Annotation added successfully', 'success')
      },
    }))
    .views((self) => {
      const superContextMenuItems = self.contextMenuItems
      return {
        contextMenuItems() {
          const feature = self.contextMenuFeature
          if (!feature) {
            return superContextMenuItems()
          }
          return [
            ...superContextMenuItems(),
            {
              label: 'Create Apollo annotation',
              icon: AddIcon,
              onClick: self.onPileupFeatureContext,
            },
          ]
        },
      }
    })
  ;(pluggableElement as DisplayType).stateModel = newStateModel
  return pluggableElement
}
