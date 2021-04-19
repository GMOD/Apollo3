import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { Region } from '@jbrowse/core/util'
import { intersection2 } from '@jbrowse/core/util/range'
import { Client, Frame, Message } from '@stomp/stompjs'
import { resolveIdentifier, SnapshotIn } from 'mobx-state-tree'
import { apolloFetch } from '../apolloFetch'
import Feature from './ApolloFeature'
import BaseAnnotationDriver, { ChangeSet } from './BaseAnnotationDriver'

export default class ApolloAnnotationDriver extends BaseAnnotationDriver {
  client: Client

  organismNames: string[]

  organisms: Map<string, Map<string, number>> = new Map()

  constructor(
    configuration: AnyConfigurationModel,
    featuresHandle: any,
    organismNames: string[],
  ) {
    super(configuration, featuresHandle)
    this.organismNames = organismNames
    const client = this.createClient(configuration)
    this.client = client
    this.getOrganisms()
  }

  createClient(configuration: AnyConfigurationModel) {
    const apolloId = readConfObject(configuration.apolloConfig, 'apolloId')
    const apolloName = readConfObject(configuration.apolloConfig, 'name')

    const username = sessionStorage.getItem(`${apolloId}-apolloUsername`)
    const password = sessionStorage.getItem(`${apolloId}-apolloPassword`)
    if (!(username && password)) {
      throw new Error(`Apollo login for "${apolloName}" failed`)
    }
    const apolloUrl = readConfObject(configuration.apolloConfig, 'location').uri
    let url: URL
    try {
      url = new URL(apolloUrl)
    } catch (error) {
      throw new Error(`URL is not valid: ${apolloUrl}`)
    }
    url.protocol = url.protocol.startsWith('https') ? 'wss' : 'ws'
    url.pathname += '/stomp/websocket'
    url.search = `?username=${username}&password=${password}`
    const client = new Client({
      brokerURL: url.href,
    })
    client.onDisconnect = () => {
      client.deactivate()
      console.log('disconnected')
    }
    client.onWebSocketClose = () => {
      console.log('websocket closed')
    }
    client.onWebSocketError = _event => {
      console.error(
        'Problem opening web socket, please check URL, username, and password',
      )
    }
    client.onConnect = (_frame: Frame) => {
      console.log('client connected', client.connected)
      client.subscribe('/topic/AnnotationNotification', (message: Message) => {
        const { body } = message
        const messageBody = JSON.parse(body)
        if (messageBody.operation === 'UPDATE') {
          const featureJson = messageBody.features[0]
          const feature = resolveIdentifier(
            Feature,
            this.featuresHandle,
            featureJson.uniquename,
          )
          feature?.update(ApolloAnnotationDriver.makeFeature(featureJson))
        }
        // if (messageBody.operation === 'getFeatures') {
        //   console.log('getting features')
        //   // const features: Record<string, SnapshotIn<typeof Feature>> = {}
        //   // messageBody.features.forEach((featureData: any) => {
        //   //   const feature = makeFeature(featureData)
        //   //   features[feature.id] = feature
        //   // })
        //   // this.setFeatures(messageBody.organism, messageBody.sequence, features)
        // } else if (messageBody.operation === 'ADD') {
        //   console.log('adding')
        //   // const features: Record<string, SnapshotIn<typeof Feature>> = {}
        //   // messageBody.features.forEach((featureData: any) => {
        //   //   const feature = makeFeature(featureData)
        //   //   features[feature.id] = feature
        //   // })
        //   // this.addFeatures(
        //   //   messageBody.organism,
        //   //   messageBody.features[0].sequence,
        //   //   features,
        //   // )
        // } else {
        const finalOutput = `body\n======\n${message.body}\n====\ntype: ${
          message.binaryBody ? 'binary' : 'text'
        }\nheader:\n${JSON.stringify(message.headers)}\n=====\n`
        console.log(finalOutput)
        // }
      })
      if (username) {
        client.subscribe(
          `/topic/AnnotationNotification/user/${username}`,
          (message: Message) => {
            console.log('listening to user topic')
            const finalOutput = `body\n======\n${message.body}\n====\ntype: ${
              message.binaryBody ? 'binary' : 'text'
            }\nheader:\n${JSON.stringify(message.headers)}\n=====\n`
            console.log(finalOutput)
          },
        )
      }
    }

    client.onStompError = (frame: Frame) => {
      console.error('Broker reported error: ' + frame.headers['message'])
      console.error('Additional details: ' + frame.body)
    }

    client.activate()
    return client
  }

  async getOrganisms() {
    if (this.organisms.size) {
      return this.organisms
    }
    const organisms: Map<string, Map<string, number>> = new Map()
    for (const organismName of this.organismNames) {
      const data = { organism: organismName }
      const response = await apolloFetch(
        this.configuration.apolloConfig,
        'organism/getSequencesForOrganism',
        { body: JSON.stringify(data) },
      )
      const sequencesResponse = await response.json()
      organisms.set(
        organismName,
        new Map(
          sequencesResponse.sequences.map((seq: any) => [seq.name, seq.length]),
        ),
      )
    }
    this.organisms = organisms
    return organisms
  }

  async getFeatures(
    region: Region,
    limit?: number,
  ): Promise<Record<string, SnapshotIn<typeof Feature>>> {
    const { refName, start, end, assemblyName } = region
    const data = {
      organism: assemblyName,
      sequence: refName,
    }
    const response = await apolloFetch(
      this.configuration.apolloConfig,
      'annotationEditor/getFeatures',
      { body: JSON.stringify(data) },
    )
    if (!response.ok) {
      throw new Error(`Apollo response: ${response.statusText}`)
    }
    const result = await response.json()
    const rawFeatures = result.features.filter(
      (feature: any) =>
        intersection2(start, end, feature.location.fmin, feature.location.fmax)
          .length,
    ) as any[]
    if (limit && rawFeatures.length > limit) {
      rawFeatures.length = limit
    }
    const features: Record<string, SnapshotIn<typeof Feature>> = {}
    rawFeatures.forEach((featureData: any) => {
      const feature = ApolloAnnotationDriver.makeFeature(featureData)
      features[feature.id] = feature
    })
    return features
  }

  static makeFeature(featureData: any): SnapshotIn<typeof Feature> {
    let strand: '+' | '-' | undefined
    if (featureData.location.strand === 1) {
      strand = '+'
    } else if (featureData.location.strand === -1) {
      strand = '-'
    }
    const feature: SnapshotIn<typeof Feature> = {
      id: featureData.uniquename,
      location: {
        start: featureData.location.fmin,
        end: featureData.location.fmax,
        strand,
      },
    }
    if (featureData.children) {
      const children: Record<string, SnapshotIn<typeof Feature>> = {}
      featureData.children.forEach((child: any) => {
        const childFeature = ApolloAnnotationDriver.makeFeature(child)
        children[childFeature.id] = childFeature
      })
      feature.children = children
    }
    return feature
  }

  async getFeaturesInMultipleRegions(
    region: Region,
    limit: number,
  ): Promise<SnapshotIn<typeof Feature>[]> {
    return []
  }

  async addFeature(feature: SnapshotIn<typeof Feature>) {}

  async updateFeature(featureId: string, data: ChangeSet) {}

  async deleteFeature(region: Region) {}

  async getAnnotations(featureId: string) {
    return new Map()
  }

  async getAnnotation(featureId: string, type: string) {}

  async addAnnotation(featuredId: string, type: string, data: ChangeSet) {}

  async updateAnnotation(featuredId: string, type: string, data: ChangeSet) {}

  async deleteAnnotation(featuredId: string, type: string, data: ChangeSet) {}

  async apply(change: ChangeSet) {}

  async undo() {
    const changeSet = this.changeSets.pop()
    if (!changeSet) {
      return
    }
    this.apply(changeSet.getInverse())
  }
}
