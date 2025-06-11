/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { type Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { type DisplayType } from '@jbrowse/core/pluggableElementTypes'
import type PluggableElementBase from '@jbrowse/core/pluggableElementTypes/PluggableElementBase'
import {
  type AbstractSessionModel,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { type LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import AddIcon from '@mui/icons-material/Add'
import ObjectID from 'bson-objectid'

import { CreateApolloAnnotation } from '../components/CreateApolloAnnotation'

function parseCigar(cigar: string): [string, number][] {
  const regex = /(\d+)([MIDNSHPX=])/g
  const result: [string, number][] = []
  let match

  while ((match = regex.exec(cigar)) !== null) {
    result.push([match[2], Number.parseInt(match[1], 10)])
  }

  return result
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
      getAnnotationFeature() {
        const feature = self.contextMenuFeature
        const assembly = self.getAssembly()
        const refSeqId = self.getRefSeqId(assembly)
        const start: number = feature.get('start')
        const end: number = feature.get('end')
        const strand = feature.get('strand')
        const name = feature.get('name')

        const cigarData: string = feature.get('CIGAR')
        const ops = parseCigar(cigarData)
        let position = start
        let currentExonStart: number | undefined
        const exons: {
          start: number
          end: number
        }[] = []

        // Example: [[96,S], [4,M], [4216,N], [357,M], [1,I], [628,M], [94,S]]
        // Results in 2 exons
        // M, = and X are matches -> exon
        // N is a gap in the reference sequence -> intron
        // I, S, H and P -> not counted in reference position
        for (const [op, len] of ops) {
          switch (op) {
            case 'M':
            case '=':
            case 'X': {
              if (currentExonStart === undefined) {
                currentExonStart = position
              }
              position += len
              break
            }

            case 'N': {
              if (currentExonStart !== undefined) {
                exons.push({
                  start: currentExonStart,
                  end: position,
                })
                currentExonStart = undefined
              }
              position += len
              break
            }
            case 'D': {
              position += len
              break
            }
            case 'I':
            case 'S':
            case 'H':
            case 'P': {
              // These operations do not affect the position in the reference sequence
              break
            }
            default: {
              throw new Error(`Unknown CIGAR operation: ${op}`)
            }
          }
        }

        // If still in exon at end
        if (currentExonStart !== undefined) {
          exons.push({
            start: currentExonStart,
            end: position,
          })
        }

        const newFeature: AnnotationFeatureSnapshot = {
          _id: ObjectID().toHexString(),
          refSeq: refSeqId,
          min: start,
          max: end,
          type: 'mRNA',
          strand,
          attributes: {
            name: [name],
          },
        }
        if (exons.length === 0) {
          return newFeature
        }

        const children: Record<string, AnnotationFeatureSnapshot> = {}
        newFeature.children = children

        for (const exon of exons) {
          const newExon: AnnotationFeatureSnapshot = {
            _id: ObjectID().toHexString(),
            refSeq: refSeqId,
            min: exon.start,
            max: exon.end,
            type: 'exon',
            strand,
          }
          newFeature.children[newExon._id] = newExon
        }
        return newFeature
      },
    }))
    .views((self) => {
      const superContextMenuItems = self.contextMenuItems
      return {
        contextMenuItems() {
          const session = getSession(self)
          const assembly = self.getAssembly()
          const region = self.getFirstRegion()
          const feature = self.contextMenuFeature
          if (!feature) {
            return superContextMenuItems()
          }
          return [
            ...superContextMenuItems(),
            {
              label: 'Create Apollo annotation',
              icon: AddIcon,
              onClick: () => {
                ;(session as unknown as AbstractSessionModel).queueDialog(
                  (doneCallback) => [
                    CreateApolloAnnotation,
                    {
                      session,
                      handleClose: () => {
                        doneCallback()
                      },
                      annotationFeature: self.getAnnotationFeature(assembly),
                      assembly,
                      refSeqId: self.getRefSeqId(assembly),
                      region,
                    },
                  ],
                )
              },
            },
          ]
        },
      }
    })
  ;(pluggableElement as DisplayType).stateModel = newStateModel
  return pluggableElement
}
