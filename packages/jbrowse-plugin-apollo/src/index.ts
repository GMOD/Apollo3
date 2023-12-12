import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  DisplayType,
  InternetAccountType,
  PluggableElementType,
  TrackType,
  ViewType,
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes'
import PluggableElementBase from '@jbrowse/core/pluggableElementTypes/PluggableElementBase'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  Feature,
  Region,
  SimpleFeature,
  getSession,
  isAbstractMenuManager,
} from '@jbrowse/core/util'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import AddIcon from '@mui/icons-material/Add'
import { changeRegistry, checkRegistry } from 'apollo-common'
import { AnnotationFeatureSnapshot, ApolloAssembly } from 'apollo-mst'
import {
  AddFeatureChange,
  CDSCheck,
  CoreValidation,
  ParentChildValidation,
  changes,
  validationRegistry,
} from 'apollo-shared'
import ObjectID from 'bson-objectid'
import { IMSTMap } from 'mobx-state-tree'

import { version } from '../package.json'
import {
  configSchema as apolloInternetAccountConfigSchema,
  modelFactory as apolloInternetAccountModelFactory,
} from './ApolloInternetAccount'
import { installApolloSequenceAdapter } from './ApolloSequenceAdapter'
import {
  ApolloSixFrameRenderer,
  ReactComponent as ApolloSixFrameRendererReactComponent,
  configSchema as apolloSixFrameRendererConfigSchema,
} from './ApolloSixFrameRenderer'
import { installApolloTextSearchAdapter } from './ApolloTextSearchAdapter'
import { BackendDriver } from './BackendDrivers'
import {
  DownloadGFF3,
  ManageChecks,
  OpenLocalFile,
  ViewChangeLog,
} from './components'
import { AddFeature } from './components/AddFeature'
import { ViewCheckResults } from './components/ViewCheckResults'
import ApolloPluginConfigurationSchema from './config'
import {
  stateModelFactory as LinearApolloDisplayStateModelFactory,
  configSchemaFactory as linearApolloDisplayConfigSchemaFactory,
} from './LinearApolloDisplay'
import {
  DisplayComponent,
  makeSixFrameDisplayComponent,
} from './makeDisplayComponent'
import { ApolloSessionModel, extendSession } from './session'
import {
  stateModelFactory as SixFrameFeatureDisplayStateModelFactory,
  configSchemaFactory as sixFrameFeatureDisplayConfigSchemaFactory,
} from './SixFrameFeatureDisplay'

interface RpcHandle {
  on(event: string, listener: (event: MessageEvent) => void): this
  workers: Worker[]
}

interface ApolloMessageData {
  apollo: true
  messageId: string
  method: string
  region: Region
  sequence: string
  assembly: string
}

function isApolloMessageData(data?: unknown): data is ApolloMessageData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'apollo' in data &&
    data.apollo === true
  )
}

const parseCigar = (cigar: string): [string | undefined, number][] => {
  return (cigar.toUpperCase().match(/\d+\D/g) ?? []).map((op) => {
    return [(op.match(/\D/) ?? [])[0], Number.parseInt(op, 10)]
  })
}
const createExonSubFeature = (
  feature: Feature,
  start: number,
  end: number,
): AnnotationFeatureSnapshot => {
  return {
    _id: '',
    refSeq: feature.get('refName'),
    type: 'exon',
    start,
    end,
    strand: feature.get('strand'),
  }
}
const inWebWorker = 'WorkerGlobalScope' in globalThis

for (const [changeName, change] of Object.entries(changes)) {
  changeRegistry.registerChange(changeName, change)
}

const cdsCheck = new CDSCheck()
checkRegistry.registerCheck(cdsCheck.name, cdsCheck)
validationRegistry.registerValidation(new CoreValidation())
validationRegistry.registerValidation(new ParentChildValidation())

export default class ApolloPlugin extends Plugin {
  name = 'ApolloPlugin'
  version = version
  configurationSchema = ApolloPluginConfigurationSchema

  install(pluginManager: PluginManager) {
    installApolloSequenceAdapter(pluginManager)
    installApolloTextSearchAdapter(pluginManager)
    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'ApolloTrack',
        { adapter: '' },
        {
          baseConfiguration: createBaseTrackConfig(pluginManager),
          explicitIdentifier: 'trackId',
        },
      )
      return new TrackType({
        name: 'ApolloTrack',
        configSchema,
        stateModel: createBaseTrackModel(
          pluginManager,
          'ApolloTrack',
          configSchema,
        ),
      })
    })

    pluginManager.addInternetAccountType(() => {
      return new InternetAccountType({
        name: 'ApolloInternetAccount',
        configSchema: apolloInternetAccountConfigSchema,
        stateModel: apolloInternetAccountModelFactory(
          apolloInternetAccountConfigSchema,
          pluginManager,
        ),
      })
    })

    pluginManager.addDisplayType(() => {
      const configSchema = linearApolloDisplayConfigSchemaFactory(pluginManager)
      return new DisplayType({
        name: 'LinearApolloDisplay',
        configSchema,
        stateModel: LinearApolloDisplayStateModelFactory(
          pluginManager,
          configSchema,
        ),
        trackType: 'ApolloTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: DisplayComponent,
      })
    })

    pluginManager.addDisplayType(() => {
      const configSchema =
        sixFrameFeatureDisplayConfigSchemaFactory(pluginManager)
      const SixFrameDisplayComponent =
        makeSixFrameDisplayComponent(pluginManager)
      return new DisplayType({
        name: 'SixFrameFeatureDisplay',
        configSchema,
        stateModel: SixFrameFeatureDisplayStateModelFactory(
          pluginManager,
          configSchema,
        ),
        trackType: 'ApolloTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: SixFrameDisplayComponent,
      })
    })

    pluginManager.addRendererType(
      () =>
        new ApolloSixFrameRenderer({
          name: 'ApolloSixFrameRenderer',
          ReactComponent: ApolloSixFrameRendererReactComponent,
          configSchema: apolloSixFrameRendererConfigSchema,
          pluginManager,
        }),
    )

    pluginManager.addToExtensionPoint(
      'Core-extendSession',
      extendSession.bind(this, pluginManager),
    )

    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      (pluggableElement: PluggableElementType) => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const { stateModel } = pluggableElement as ViewType
          const lgv = stateModel as LinearGenomeViewStateModel
          const newStateModel = lgv.views((self) => {
            const superRubberBandMenuItems = self.rubberBandMenuItems
            return {
              rubberBandMenuItems() {
                return [
                  ...superRubberBandMenuItems(),
                  {
                    label: 'Add new feature',
                    icon: AddIcon,
                    onClick: () => {
                      const session = getSession(
                        self,
                      ) as unknown as ApolloSessionModel
                      const { leftOffset, rightOffset } = self
                      const selectedRegions = self.getSelectedRegions(
                        leftOffset,
                        rightOffset,
                      )
                      ;(session as unknown as AbstractSessionModel).queueDialog(
                        (doneCallback) => [
                          AddFeature,
                          {
                            session,
                            handleClose: () => {
                              doneCallback()
                            },
                            region: selectedRegions[0],
                            changeManager:
                              session.apolloDataStore.changeManager,
                          },
                        ],
                      )
                    },
                  },
                ]
              },
            }
          })
          ;(pluggableElement as ViewType).stateModel = newStateModel
        }
        return pluggableElement
      },
    )

    // ISSUE 336 BEGINS
    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      (pluggableElement) => {
        if (
          (pluggableElement as PluggableElementBase).name ===
          'LinearPileupDisplay'
        ) {
          const { stateModel } = pluggableElement as DisplayType
          const newStateModel = stateModel.extend((self) => {
            const superContextMenuItems = self.contextMenuItems
            return {
              views: {
                contextMenuItems() {
                  const feature = self.contextMenuFeature
                  if (!feature) {
                    // we're not adding any menu items since the click was not on a feature
                    return superContextMenuItems()
                  }
                  return [
                    ...superContextMenuItems(),
                    {
                      label: 'Create annotation',
                      icon: AddIcon,
                      onClick: async () => {
                        console.log('Feature:', JSON.stringify(feature))
                        const cigarData = feature.data.CIGAR
                        // 12M3N5M9N4M
                        // split <Number>Cigar
                        const ops = parseCigar(cigarData)
                        let currOffset = 0
                        const { start } = feature.data
                        feature.set('subfeatures', [])
                        let openExon = false
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        let openStart: any
                        const exonArray: AnnotationFeatureSnapshot[] = []
                        for (const oprec of ops) {
                          // eslint-disable-next-line prefer-destructuring
                          const op = oprec[0]
                          const len = oprec[1]

                          // 1. open or continue open
                          if (op === 'M' || op === '=' || op === 'E') {
                            // if it was closed, then open with start, strand, type
                            if (!openExon) {
                              // add subfeature
                              openStart = currOffset + start
                              openExon = true
                            }
                          } else if (
                            op === 'N' && // if it was open, then close and add the subfeature
                            openExon
                          ) {
                            const feat = createExonSubFeature(
                              feature,
                              openStart,
                              currOffset + start,
                            )
                            exonArray.push(feat)
                            openExon = false
                          }
                          // we ignore insertions when calculating potential exon length
                          if (op !== 'I') {
                            currOffset += len
                          }
                        }

                        // F. if we are still open, then close with the final length and add subfeature
                        if (openExon && openStart !== undefined) {
                          const feat = createExonSubFeature(
                            feature,
                            openStart,
                            currOffset + start,
                          )
                          exonArray.push(feat)
                        }
                        // const assembly = session.apolloDataStore.assemblies.get(
                        //   region.assemblyName,
                        // )
                        // const ref = assembly?.getByRefName(region.refName)

                        const children: Record<
                          string,
                          AnnotationFeatureSnapshot
                        > = {}
                        const disContLoc: {
                          start: number
                          end: number
                          phase?: 0 | 1 | 2
                        }[] = []
                        console.log(`EXONS: ${JSON.stringify(exonArray)}`)
                        let strand,
                          phase,
                          mRNAstart = 0,
                          mRNAend = 0
                        for (const [i, snapshot] of exonArray.entries()) {
                          strand = snapshot.strand
                          phase = snapshot.phase
                          if (mRNAstart === 0 || snapshot.start < mRNAstart) {
                            mRNAstart = Number(snapshot.start) - 1
                          }
                          if (mRNAend === 0 || snapshot.end > mRNAend) {
                            mRNAend = Number(snapshot.end)
                          }
                          if (exonArray.length > 1) {
                            const newChild: AnnotationFeatureSnapshot = {
                              _id: new ObjectID().toHexString(),
                              start: Number(snapshot.start) - 1,
                              end: Number(snapshot.end),
                              type: 'exon',
                              refSeq: '65670e19a8c9de1496adff58',
                            }
                            children[newChild._id] = newChild
                            // Add discontinous locations
                            disContLoc.push({
                              start: Number(snapshot.start) - 1,
                              end: Number(snapshot.end),
                              phase: snapshot.phase,
                            })
                          }
                        }
                        // Create also CDS child
                        if (exonArray.length > 1) {
                          const newChild: AnnotationFeatureSnapshot = {
                            _id: new ObjectID().toHexString(),
                            start: mRNAstart,
                            end: mRNAend,
                            type: 'CDS',
                            refSeq: '65670e19a8c9de1496adff58',
                          }
                          children[newChild._id] = newChild
                        }
                        const id = new ObjectID().toHexString()
                        const change = new AddFeatureChange({
                          changedIds: [id],
                          typeName: 'AddFeatureChange',
                          assembly: '65670e1581b16efd76d513dc',
                          addedFeature: {
                            _id: id,
                            gffId: '',
                            refSeq: '65670e19a8c9de1496adff58', // snapshot.refSeq,
                            start: mRNAstart,
                            end: mRNAend,
                            children: children as unknown as Record<
                              string,
                              AnnotationFeatureSnapshot
                            >,
                            discontinuousLocations: disContLoc,
                            type: 'mRNA',
                            phase,
                            strand,
                          },
                        })
                        const session = getSession(
                          self,
                        ) as unknown as ApolloSessionModel
                        console.log(`change: ${JSON.stringify(change)}`)
                        const { assemblies } = session.apolloDataStore as {
                          assemblies: IMSTMap<typeof ApolloAssembly>
                        }
                        console.log(`assemblies: ${JSON.stringify(assemblies)}`)

                        // console.log(`session: ${JSON.stringify(session)}`)
                        // console.log(
                        //   `assemblies: ${JSON.stringify(
                        //     session.apolloDataStore.assemblies,
                        //   )}`,
                        // )
                        await session.apolloDataStore.changeManager.submit?.(
                          change,
                        )
                        // notify('Feature added successfully', 'success')
                      },
                    },
                  ]
                },
              },
            }
          })
          ;(pluggableElement as DisplayType).stateModel = newStateModel
        }
        return pluggableElement
      },
    )
    if (!inWebWorker) {
      pluginManager.addToExtensionPoint(
        'Core-extendWorker',
        (handle: RpcHandle) => {
          if (!('on' in handle && handle.on)) {
            return handle
          }
          handle.on('apollo', async (event: MessageEvent) => {
            if (!isApolloMessageData(event)) {
              return
            }
            const { apollo, messageId, method } = event
            switch (method) {
              case 'getSequence': {
                const { region } = event
                const { assemblyName } = region
                const dataStore = (
                  pluginManager.rootModel?.session as
                    | ApolloSessionModel
                    | undefined
                )?.apolloDataStore
                if (!dataStore) {
                  break
                }
                const backendDriver = dataStore.getBackendDriver(
                  assemblyName,
                ) as BackendDriver
                const { seq: sequence } =
                  await backendDriver.getSequence(region)
                handle.workers[0].postMessage({
                  apollo,
                  messageId,
                  sequence,
                })
                break
              }
              case 'getRegions': {
                const { assembly } = event
                const dataStore = (
                  pluginManager.rootModel?.session as
                    | ApolloSessionModel
                    | undefined
                )?.apolloDataStore
                if (!dataStore) {
                  break
                }
                const backendDriver = dataStore.getBackendDriver(
                  assembly,
                ) as BackendDriver
                const regions = await backendDriver.getRegions(assembly)
                handle.workers[0].postMessage({
                  apollo,
                  messageId,
                  regions,
                })
                break
              }
              default: {
                break
              }
            }
          })
          return handle
        },
      )
    }
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.insertMenu('Apollo', -1)
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'Download GFF3',
        onClick: (session: ApolloSessionModel) => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              DownloadGFF3,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
              },
            ],
          )
        },
      })
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'Manage Checks',
        onClick: (session: ApolloSessionModel) => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              ManageChecks,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
              },
            ],
          )
        },
      })
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'View Change Log',
        onClick: (session: ApolloSessionModel) => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              ViewChangeLog,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
              },
            ],
          )
        },
      })
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'Open local GFF3 file',
        onClick: (session: ApolloSessionModel) => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              OpenLocalFile,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
                inMemoryFileDriver: session.apolloDataStore.inMemoryFileDriver,
              },
            ],
          )
        },
      })
      pluginManager.rootModel.appendToMenu('Apollo', {
        label: 'View check results',
        onClick: (session: ApolloSessionModel) => {
          ;(session as unknown as AbstractSessionModel).queueDialog(
            (doneCallback) => [
              ViewCheckResults,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
              },
            ],
          )
        },
      })
    }
  }
}
