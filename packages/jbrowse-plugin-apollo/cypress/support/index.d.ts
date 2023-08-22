/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable<Subject> {
    loginAsGuest(configJsonFile: string): Chainable<void>
    addAssemblyFromGff(assemblyName: string, fin: string): Chainable<void>
    selectAssemblyToView(assemblyName: string): Chainable<void>
    searchFeatures(query: string): Chainable<void>
    currentLocationEquals(
      contig: string,
      start: number,
      end: number,
      tolerance: number,
    ): Chainable<void>
  }
}
