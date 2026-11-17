import { changeRegistry } from '@apollo-annotation/common'
import type {
  ServerChangeContext,
  ServerChangeType,
} from '@apollo-annotation/common/server'

import { Role } from '../utils/role/role.enum.js'

/**
 * The context the server applies changes with. Built-in change handlers also
 * get an ID unique to this submission, used to mark temporary documents.
 */
export interface InternalChangeContext extends ServerChangeContext {
  uniqueUserId: string
}

/** Every change type this server can apply, built-in or from plugins */
export class ServerChangeTypeRegistry {
  private readonly changeTypes = new Map<string, ServerChangeType>()

  /**
   * Register a change type and its handler. Also registers the change class
   * so submitted changes of this type can be deserialized.
   */
  register(name: string, changeType: ServerChangeType) {
    if (this.changeTypes.has(name)) {
      throw new Error(`change type "${name}" has already been registered`)
    }
    changeRegistry.registerChange(name, changeType.changeType)
    this.changeTypes.set(name, changeType)
  }

  get(name: string): ServerChangeType {
    const changeType = this.changeTypes.get(name)
    if (!changeType) {
      throw new Error(`No handler registered for change type "${name}"`)
    }
    return changeType
  }

  has(name: string) {
    return this.changeTypes.has(name)
  }

  /** The role needed to submit a change of this type */
  getRequiredRole(name: string): Role {
    return this.changeTypes.get(name)?.requiredRole === 'admin'
      ? Role.Admin
      : Role.User
  }
}

export const serverChangeTypes = new ServerChangeTypeRegistry()
