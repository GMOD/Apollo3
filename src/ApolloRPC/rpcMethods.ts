import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export class ApolloSetCredentials extends RpcMethodType {
  name = 'ApolloSetCredentials'

  async execute(args: {
    adapterConfig: {}
    signal?: RemoteAbortSignal
    headers?: Record<string, string>
    sessionId: string
    username: string
    password: string
  }) {
    const deserializedArgs = await this.deserializeArguments(args)
    const { adapterConfig, sessionId, username, password } = deserializedArgs
    const dataAdapter = getAdapter(this.pluginManager, sessionId, adapterConfig)
      .dataAdapter as BaseFeatureDataAdapter
    // @ts-ignore
    dataAdapter.setUsername(username)
    // @ts-ignore
    dataAdapter.setPassword(password)
  }
}
