import { changeRegistry } from '@apollo-annotation/common'
import type { ClientChangeType } from '@apollo-annotation/common/client'

/** Every change type this client knows about, built-in or from plugins */
export class ClientChangeTypeRegistry {
  private readonly changeTypes = new Map<string, ClientChangeType>()

  /**
   * Register a change type and its client handler. Also registers the change
   * class so changes of this type from the server can be deserialized.
   */
  register(name: string, changeType: ClientChangeType) {
    if (this.changeTypes.has(name)) {
      throw new Error(`change type "${name}" has already been registered`)
    }
    changeRegistry.registerChange(name, changeType.changeType)
    this.changeTypes.set(name, changeType)
  }

  get(name: string): ClientChangeType | undefined {
    return this.changeTypes.get(name)
  }
}

export const clientChangeTypes = new ClientChangeTypeRegistry()
