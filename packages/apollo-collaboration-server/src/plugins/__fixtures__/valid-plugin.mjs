export default class ValidPlugin {
  name = 'ValidPlugin'

  install(registrar) {
    registrar.registerHook('Apollo-RegisterRoutes', (routes) => routes)
  }
}
