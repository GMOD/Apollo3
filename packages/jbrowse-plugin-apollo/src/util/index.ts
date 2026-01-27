import { getParent } from '@jbrowse/mobx-state-tree'

import { type ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { type ApolloSessionModel } from '../session'
import { type ApolloRootModel } from '../types'

export async function createFetchErrorMessage(
  response: Response,
  additionalText?: string,
): Promise<string> {
  let errorMessage
  try {
    errorMessage = await response.text()
  } catch {
    errorMessage = ''
  }
  const responseMessage = `${response.status} ${response.statusText}${
    errorMessage ? ` (${errorMessage})` : ''
  }`
  return `${additionalText ? `${additionalText} — ` : ''}${responseMessage}`
}

/** given a session, get our ApolloInternetAccount */
export function getApolloInternetAccount(session: ApolloSessionModel) {
  const { internetAccounts } = getParent<ApolloRootModel>(session)
  return internetAccounts.find((ia) => ia.type === 'ApolloInternetAccount') as
    | ApolloInternetAccountModel
    | undefined
}

export * from './loadAssemblyIntoClient'
export * from './annotationFeatureUtils'
export * from './glyphUtils'
export * from './mouseEventsUtils'
