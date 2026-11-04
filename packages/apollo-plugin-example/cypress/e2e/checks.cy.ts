// Exercises ExampleShortFeatureCheck, which is registered by both halves of
// the plugin but isn't on by default
describe('Example plugin check', () => {
  beforeEach(() => {
    cy.setupJBrowseConfig()
    cy.loginAsGuest()
    cy.addAssemblyFromGff('example', 'cypress/fixtures/example.fasta.gff3')
    cy.selectAssemblyToView('example', 'ctgA:1..700')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
  })

  afterEach(() => {
    cy.deleteAssemblies()
  })

  it('Flags short features once the check is turned on', () => {
    // shortgene01 is 2 bases long, starting at 400 (zero-based)
    cy.get('[data-testid="ErrorIcon-400"]').should('not.exist')

    cy.selectFromApolloMenu(['Admin', 'Manage Checks'])
    cy.get('[data-testid="manage-checks"]').within(() => {
      cy.contains('tr', 'ExampleShortFeatureCheck', { timeout: 10_000 })
        .find('input[type="checkbox"]')
        .should('not.be.checked')
        .check()
      cy.contains('button', 'Submit').click()
    })
    cy.contains('Assembly checks updated successfully')

    cy.get('[data-testid="ErrorIcon-400"]', { timeout: 10_000 }).trigger(
      'mouseover',
    )
    cy.contains('Feature is shorter than 3 bases')
  })
})
