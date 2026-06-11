/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { describe, expect, it, jest } from '@jest/globals'

import { Role } from '../utils/role/role.enum.js'

import { JBrowseService } from './jbrowse.service.js'

type JBrowseServiceCtorArgs = ConstructorParameters<typeof JBrowseService>
type AssembliesResult = Awaited<ReturnType<JBrowseService['getAssemblies']>>
type TracksResult = Awaited<ReturnType<JBrowseService['getTracks']>>

function makeService() {
  return new JBrowseService(
    {} as JBrowseServiceCtorArgs[0],
    {} as JBrowseServiceCtorArgs[1],
    {} as JBrowseServiceCtorArgs[2],
    {} as JBrowseServiceCtorArgs[3],
  )
}

describe('JBrowseService', () => {
  it('should be defined', () => {
    const service = makeService()
    expect(service).toBeDefined()
  })

  it('returns a minimal config for unauthenticated requests', async () => {
    const service = makeService()
    const configuration = { theme: {} }
    const plugins = [{ name: 'Apollo', url: 'apollo.js' }]
    const internetAccounts = [{ type: 'ApolloInternetAccount' }]

    jest.spyOn(service, 'getConfiguration').mockReturnValue(configuration)
    jest.spyOn(service, 'getPlugins').mockReturnValue(plugins)
    jest.spyOn(service, 'getInternetAccounts').mockReturnValue(internetAccounts)

    await expect(service.getConfig()).resolves.toEqual({
      configuration,
      plugins,
      internetAccounts,
    })
  })

  it('includes assemblies and tracks for guest-authenticated requests', async () => {
    const service = makeService()
    const configuration = { theme: {}, ApolloPlugin: { hasRole: true } }
    const assemblies = [{ name: 'assembly-1' }] as AssembliesResult
    const tracks = [{ trackId: 'track-1' }] as TracksResult
    const plugins = [{ name: 'Apollo', url: 'apollo.js' }]
    const internetAccounts = [{ type: 'ApolloInternetAccount' }]
    const defaultSession = { name: 'Apollo', views: [] }

    jest.spyOn(service, 'getConfiguration').mockReturnValue(configuration)
    jest.spyOn(service, 'getAssemblies').mockResolvedValue(assemblies)
    jest.spyOn(service, 'getTracks').mockResolvedValue(tracks)
    jest.spyOn(service, 'getPlugins').mockReturnValue(plugins)
    jest.spyOn(service, 'getInternetAccounts').mockReturnValue(internetAccounts)
    jest.spyOn(service, 'getDefaultSession').mockReturnValue(defaultSession)
    jest.spyOn(service, 'getJBrowseConfig').mockResolvedValue()

    await expect(service.getConfig(Role.None)).resolves.toEqual({
      configuration,
      assemblies,
      tracks,
      plugins,
      internetAccounts,
      defaultSession,
    })
  })
})
