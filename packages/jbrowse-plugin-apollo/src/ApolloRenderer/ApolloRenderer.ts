import { RenderProps, RendererType } from '@jbrowse/core/pluggableElementTypes'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

export default class ApolloRenderer extends RendererType {
  async renderInClient(_rpcManager: RpcManager, args: RenderProps) {
    return this.render(args)
  }

  async freeResourcesInClient(_rpcManager: RpcManager, _args: RenderProps) {
    return 0
  }
}
