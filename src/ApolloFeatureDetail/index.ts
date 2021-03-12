import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
// import { Client } from '@stomp/stompjs'

const configSchema = ConfigurationSchema('ApolloWidget', {})

export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model('ApolloWidget', {
      id: ElementId,
      type: types.literal('ApolloWidget'),
      featureData: types.frozen(),
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
      apolloUrl: types.string,
    })
    .volatile(() => ({
      socket: undefined as any | undefined,
    }))
    .actions(self => ({
      setFeatureData(data: any) {
        self.featureData = data
      },
      clearFeatureData() {
        self.featureData = undefined
      },
      setSocket(socket: any) {
        self.socket = socket
      },
      async afterCreate() {
        const headers = new Headers()
        const username = 'demo@demo.com'
        const password = 'demo'
        const authorization = `${username}:${password}`
        headers.append('Authorization', 'Basic' + btoa(authorization))
        const response = await fetch(self.apolloUrl, {
          mode: 'no-cors',
          credentials: 'include',
          method: 'POST',
          headers: headers,
        })
        console.log(response)
      },
      // send something thru the websocket and see if i get a response back
      // will have to create listeners in the widget and set it
      // will pass an update function to socket
      // anything that runs need to check that socket is set (not undefined)
      // may have to check for user login stuff, check annotation track in apollo 1 for reference, may have to provide stuff to open the websocket
      // username and passwword code is in renderProps in LinearApolloDisplay/model.ts

      // the stomp/stompjs stuff, uncomment when websockets are figured out
      // afterCreate() {
      //   // const url = self.featureData.url
      //   // getting the url, more stable than inspecting feature, only use above if can't get any other way to work

      //   const wssUrl =
      //     self.apolloUrl.replace(/^\/\/|^.*?:(\/\/)?/, 'ws://') + '/stomp'
      //   const client = new Client({
      //     brokerURL: wssUrl,
      //     // add username/pass from render props prob
      //     connectHeaders: {
      //       login: 'demo@demo.com',
      //       passcode: 'demo',
      //     },
      //     debug: function(str) {
      //       // eslint-disable-next-line no-console
      //       console.log(str)
      //     },
      //   })
      //   client.onConnect = function(frame) {
      //     console.log('I have connected', frame.body)
      //   }
      //   client.onStompError = function(frame) {
      //     // Will be invoked in case of error encountered at Broker
      //     // Bad login/passcode typically will cause an error
      //     // Complaint brokers will set `message` header with a brief message. Body may contain details.
      //     // Compliant brokers will terminate the connection after any error
      //     console.log('Broker reported error: ' + frame.headers['message'])
      //     console.log('Additional details: ' + frame.body)
      //   }

      //   client.onWebSocketError = function(webSocketError) {
      //     console.log('websocket error is', webSocketError)
      //   }

      //   this.setSocket(client)
      //   client.activate()
      // },
    }))
}

export { configSchema, stateModelFactory }
export { default as ReactComponent } from './ApolloFeatureDetail'
