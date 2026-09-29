import { Change } from '@apollo-annotation/common'
import type { CheckResultSnapshot } from '@apollo-annotation/mst'
import type {
  ChangeMessage,
  CheckResultUpdate,
  RequestUserInformationMessage,
  UserLocationMessage,
} from '@apollo-annotation/shared'

import type { Collaborator } from '../session'

/** What the server-sent event handlers need from the session */
export interface EventSourceHandlerContext {
  /** The session ID of this client, see `makeUserSessionId` */
  localSessionId: string
  /** This client's JWT */
  token: string
  addCheckResult(checkResult: CheckResultSnapshot): void
  deleteCheckResult(checkResultId: string): void
  /** Apply a change from another session without sending it to the server */
  applyRemoteChange(change: Change): void
  addOrUpdateCollaborator(collaborator: Collaborator): void
  broadcastLocations(): void
}

export function handleCommonMessage(
  message: ChangeMessage | CheckResultUpdate,
  context: EventSourceHandlerContext,
) {
  if ('checkResult' in message) {
    if (message.deleted) {
      context.deleteCheckResult(message.checkResult._id)
    } else {
      context.addCheckResult(message.checkResult)
    }
    return
  }
  // Save server last change sequence into session storage
  sessionStorage.setItem('LastChangeSequence', String(message.changeSequence))
  if (message.userSessionId === context.localSessionId) {
    return // we did this change, no need to apply it again
  }
  const change = Change.fromJSON(message.changeInfo)
  context.applyRemoteChange(change)
}

export function handleUserLocationMessage(
  message: UserLocationMessage,
  context: EventSourceHandlerContext,
) {
  const { channel, locations, userName, userSessionId } = message
  if (channel === 'USER_LOCATION' && userSessionId !== context.localSessionId) {
    context.addOrUpdateCollaborator({
      name: userName,
      id: userSessionId,
      locations,
    })
  }
}

export function handleRequestInformationMessage(
  message: RequestUserInformationMessage,
  context: EventSourceHandlerContext,
) {
  const { channel, userSessionId } = message
  if (channel === 'REQUEST_INFORMATION' && userSessionId !== context.token) {
    context.broadcastLocations()
  }
}
