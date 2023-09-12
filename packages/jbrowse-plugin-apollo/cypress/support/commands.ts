Cypress.Commands.add('loginAsGuest', () => {
  cy.fixture('config.json').then((config) => {
    cy.visit(config.apollo_url)
  })
  cy.contains('Continue as Guest', { timeout: 10_000 }).click()
  cy.wait(2000)
  cy.reload()
})

Cypress.Commands.add('deleteAssemblies', () => {
  for (const x of ['assemblies', 'features']) {
    cy.log(x)
    cy.deleteMany({}, { collection: x }).then((results: undefined) => {
      cy.log(`Collection ${x}: ${results}` as unknown as string)
    })
  }
})

Cypress.Commands.add('addAssemblyFromGff', (assemblyName, fin) => {
  cy.get('button[data-testid="dropDownMenuButton"]', { timeout: 10_000 })
    .contains('Apollo')
    .click({ force: true, timeout: 10_000 })
  cy.contains('Add Assembly', { timeout: 10_000 }).click()
  cy.get('input[type="TextField"]').type(assemblyName)
  cy.get('input[value="text/x-gff3"]').check()
  cy.get('input[type="file"]').selectFile(fin)
  cy.get('[data-testid="CheckBoxIcon"]')
    .parent()
    .children()
    .get('input[type="checkbox"]')
    .should('be.checked')
  cy.intercept('/changes').as('changes')
  cy.contains('Submit').click()
  cy.wait('@changes').its('response.statusCode').should('match', /2../)
  cy.reload()
  cy.contains('Select assembly to view', { timeout: 10_000 })
})

Cypress.Commands.add('selectAssemblyToView', (assemblyName) => {
  cy.contains('Select assembly to view', { timeout: 10_000 })
  cy.get('[data-testid="assembly-selector"]').parent().click()
  cy.contains(assemblyName).parent().click()
  cy.intercept('POST', '/users/userLocation').as('selectAssemblyToViewDone')
  cy.contains('Open').click()
  cy.wait('@selectAssemblyToViewDone')
})

Cypress.Commands.add('searchFeatures', (query) => {
  cy.intercept('POST', '/users/userLocation').as('searchFeaturesDone')
  cy.get('input[placeholder="Search for location"]').type(`${query}{enter}`)
  cy.wait('@searchFeaturesDone')
})

Cypress.Commands.add(
  'currentLocationEquals',
  (contig, start, end, tolerance) => {
    cy.get('input[placeholder="Search for location"]')
      .invoke('val')
      .as('currentLocation')

    cy.get<string>('@currentLocation').then((currentLocation) => {
      const [xcontig, s, e] = currentLocation.split(/:|\.\./)
      const xstart: number = Number.parseInt(s.replace(',', ''), 10)
      const xend: number = Number.parseInt(e.replace(',', ''), 10)
      expect(xcontig).equal(contig)
      expect(xstart).to.be.within(start - tolerance, end + tolerance)
      expect(xend).to.be.within(end - tolerance, end + tolerance)
    })
  },
)
