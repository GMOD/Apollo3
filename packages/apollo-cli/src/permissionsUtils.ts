import type { Response } from 'undici'

import { convertAssemblyNameToId, idReader, queryApollo } from './utils.js'

interface UserDoc {
  _id: string
  username: string
  email: string
}

export async function resolveUserId(
  address: string,
  accessToken: string,
  userInput: string,
): Promise<string> {
  const usersResponse: Response = await queryApollo(
    address,
    accessToken,
    'users',
  )
  const users = (await usersResponse.json()) as UserDoc[]

  const matches = users.filter(
    (user) =>
      user._id === userInput ||
      user.username === userInput ||
      user.email === userInput,
  )

  if (matches.length === 0) {
    throw new Error(`User '${userInput}' not found`)
  }
  if (matches.length > 1) {
    throw new Error(
      `User '${userInput}' is ambiguous. Use a unique user id instead.`,
    )
  }
  return matches[0]._id
}

export async function resolveAssemblyIds(
  address: string,
  accessToken: string,
  assemblyInputs: string[],
): Promise<string[]> {
  const parsedInputs = await idReader(assemblyInputs)
  const ids = await convertAssemblyNameToId(address, accessToken, parsedInputs)
  if (ids.length === 0) {
    throw new Error('No assemblies matched the input provided')
  }
  return ids
}
