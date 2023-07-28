import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { useEffect, useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { createFetchErrorMessage } from '../util'

export * from './AddAssembly'
export * from './AddFeature'
export * from './CopyFeature'
export * from './DeleteAssembly'
export * from './DeleteFeature'
export * from './DownloadGFF3'
export * from './GoAutocomplete'
export * from './ImportFeatures'
export * from './ManageUsers'
export * from './ModifyFeatureAttribute'
export * from './OpenLocalFile'
export * from './ViewChangeLog'

interface AssemblyResponse {
  _id: string
  name: string
}

export interface AssemblyData extends AssemblyResponse {
  internetAccount: ApolloInternetAccountModel
}

export function useAssemblies(
  internetAccounts: BaseInternetAccountModel[],
  setErrorMessage: (message: string) => void,
) {
  const [assemblies, setAssemblies] = useState<AssemblyData[]>([])

  useEffect(() => {
    async function getAssemblies() {
      const apolloInternetAccounts = internetAccounts.filter(
        (ia) => ia.type === 'ApolloInternetAccount',
      ) as ApolloInternetAccountModel[]
      if (!apolloInternetAccounts.length) {
        throw new Error('No Apollo internet account found')
      }
      for (const apolloInternetAccount of apolloInternetAccounts) {
        const { baseURL } = apolloInternetAccount
        const uri = new URL('/assemblies', baseURL).href
        const apolloFetch = apolloInternetAccount?.getFetcher({
          locationType: 'UriLocation',
          uri,
        })
        if (apolloFetch) {
          const response = await apolloFetch(uri, {
            method: 'GET',
          })
          if (!response.ok) {
            const errorMessage = await createFetchErrorMessage(
              response,
              'Error when inserting new features (while uploading file)',
            )
            setErrorMessage(errorMessage)
            return
          }
          const data = (await response.json()) as AssemblyResponse[]
          data.forEach((item) => {
            setAssemblies((result) => [
              ...result,
              {
                _id: item._id,
                name: item.name,
                internetAccount: apolloInternetAccount,
              },
            ])
          })
        }
      }
    }
    getAssemblies().catch((e) => setErrorMessage(String(e)))
    return () => {
      setAssemblies([])
    }
  }, [internetAccounts, setErrorMessage])

  return assemblies
}
