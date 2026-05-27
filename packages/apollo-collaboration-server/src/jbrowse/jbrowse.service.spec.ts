import { JBrowseService } from './jbrowse.service.js'
import { Role } from '../utils/role/role.enum.js'

describe('JBrowseService', () => {
  function makeService() {
    return new JBrowseService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )
  }

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
    const assemblies = [{ name: 'assembly-1' }]
    const tracks = [{ trackId: 'track-1' }]
    const plugins = [{ name: 'Apollo', url: 'apollo.js' }]
    const internetAccounts = [{ type: 'ApolloInternetAccount' }]
    const defaultSession = { name: 'Apollo', views: [] }

    jest.spyOn(service, 'getConfiguration').mockReturnValue(configuration)
    jest.spyOn(service, 'getAssemblies').mockResolvedValue(assemblies as never)
    jest.spyOn(service, 'getTracks').mockResolvedValue(tracks as never)
    jest.spyOn(service, 'getPlugins').mockReturnValue(plugins)
    jest.spyOn(service, 'getInternetAccounts').mockReturnValue(internetAccounts)
    jest.spyOn(service, 'getDefaultSession').mockReturnValue(defaultSession)
    jest.spyOn(service, 'getJBrowseConfig').mockResolvedValue(undefined)

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
