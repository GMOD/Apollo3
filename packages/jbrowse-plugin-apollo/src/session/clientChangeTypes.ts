import { changeRegistry } from '@apollo-annotation/common'
import type { ClientChangeType } from '@apollo-annotation/common/client'

/** Every change type this client knows about, built-in or from plugins */
export class ClientChangeTypeRegistry {
  private readonly changeTypes = new Map<string, ClientChangeType>()

  /**
   * Register a change type and its client handler. Also registers the change
   * class so changes of this type from the server can be deserialized.
   * Registering the same change class under the same name again replaces the
   * handler; a different class under an existing name is an error.
   */
  register(name: string, changeType: ClientChangeType) {
    const existing = this.changeTypes.get(name)
    if (existing) {
      if (existing.changeType !== changeType.changeType) {
        throw new Error(`change type "${name}" has already been registered`)
      }
    } else {
      changeRegistry.registerChange(name, changeType.changeType)
    }
    this.changeTypes.set(name, changeType)
  }

  get(name: string): ClientChangeType | undefined {
    return this.changeTypes.get(name)
  }
}

export const clientChangeTypes = new ClientChangeTypeRegistry()
