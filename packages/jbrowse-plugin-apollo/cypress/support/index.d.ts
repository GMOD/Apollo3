/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    addOntologies(): Chainable<void>
    loginAsGuest(): Chainable<void>
    deleteAssemblies(): Chainable<void>
    addAssemblyFromGff(assemblyName: string, fin: string): Chainable<void>
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
      deleteExistingFeatures: boolean,
    ): Chainable<void>
    closeSearchBox(): Chainable<void>
  }
}
