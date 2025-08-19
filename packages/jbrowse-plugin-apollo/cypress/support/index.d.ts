/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    addOntologies(): Chainable<void>
    loginAsGuest(): Chainable<void>
    deleteAssemblies(): Chainable<void>
    selectFromApolloMenu(menuItemName: string): Chainable<void>
    annotationTrackAppearance(
      appearance:
        | 'Show both graphical and table display'
        | 'Show graphical display'
        | 'Show table display',
    ): Chainable<void>
    addAssemblyFromGff(
      assemblyName: string,
      fin: string,
      launch?: boolean,
      loadFeatures?: boolean,
    ): Chainable<void>
    selectAssemblyToView(assemblyName: string): Chainable<void>
    searchFeatures(query: string, expectedNumOfHits: number): Chainable<void>
    currentLocationEquals(
      contig: string,
      start: number,
      end: number,
      tolerance: number,
    ): Chainable<void>
    importFeatures(
      gffFile: string,
      assemblyName: string,
      deleteExistingFeatures: boolean | undefined,
    ): Chainable<void>
    closeSearchBox(): Chainable<void>
    refreshTableEditor(): Chainable<void>
  }
}
