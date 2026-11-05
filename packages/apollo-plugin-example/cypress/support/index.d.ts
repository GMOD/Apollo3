/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    preloadOntology(): Chainable<void>
    loginAsGuest(): Chainable<void>
    clearFeatures(): Chainable<void>
    selectFromApolloMenu(menuItemNameOrPath: string | string[]): Chainable<void>
    importFeatures(gffFile: string, assemblyName: string): Chainable<void>
    selectAssemblyToView(
      assemblyName: string,
      locationOrSearch?: string,
    ): Chainable<void>
    annotationTrackAppearance(
      appearance:
        | 'Show both graphical and table display'
        | 'Show graphical display'
        | 'Show table display',
    ): Chainable<void>
    getFeature(gffId: string): Chainable<ApolloDocument>
    apolloRequest<T = unknown>(
      method: string,
      path: string,
      body?: object,
    ): Chainable<Response<T>>
  }

  /** The parts of a feature or assembly document in MongoDB the tests read */
  interface ApolloDocument {
    _id: { toHexString(): string }
    attributes?: Record<string, string[] | undefined>
  }
}
