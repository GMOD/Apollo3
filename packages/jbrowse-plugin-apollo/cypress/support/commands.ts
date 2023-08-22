Cypress.Commands.add('loginAsGuest', (configJsonFile) => {
  cy.fixture(configJsonFile).then((config) => {
    cy.visit(config.apollo_url)
  })
  cy.contains('Continue as Guest').click()
  cy.reload()
})

Cypress.Commands.add('addAssemblyFromGff', (assemblyName, fin) => {
  cy.contains('Apollo').click()
  cy.contains('Add Assembly').click()
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
})

Cypress.Commands.add('selectAssemblyToView', (assemblyName) => {
  cy.contains('Select assembly to view', { timeout: 10000 })
  cy.get('[data-testid="assembly-selector"]').parent().click()
  cy.contains(assemblyName).parent().click()
  cy.intercept('POST', '/users/userLocation').as('userLocation')
  cy.contains('Open').click()
  cy.wait('@userLocation')
})

Cypress.Commands.add('searchFeatures', (query) => {
  cy.intercept('POST', '/users/userLocation').as('userLocation')
  cy.get('input[placeholder="Search for location"]').type(`${query}{enter}`)
  cy.wait('@userLocation')
})

Cypress.Commands.add(
  'currentLocationEquals',
  (contig, start, end, tolerance) => {
    cy.get('input[placeholder="Search for location"]')
      .invoke('val')
      .as('currentLocation')

    cy.get<string>('@currentLocation').then((currentLocation) => {
      const [xcontig, s, e] = currentLocation.split(/:|\.\./)
      const xstart: number = parseInt(s.replace(',', ''), 10)
      const xend: number = parseInt(e.replace(',', ''), 10)
      expect(xcontig).equal(contig)
      expect(xstart).to.be.within(start - tolerance, end + tolerance)
      expect(xend).to.be.within(end - tolerance, end + tolerance)
    })
  },
)
