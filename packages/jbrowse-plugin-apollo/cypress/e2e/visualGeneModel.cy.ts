describe('Simple tests for visuals', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })
  afterEach(() => {
    cy.deleteAssemblies()
  })
  it('Shows correct gene model', () => {
    cy.addAssemblyFromGff('so_types.gff3', 'test_data/so_types.gff3')
    cy.selectAssemblyToView('so_types.gff3')
    cy.searchFeatures('TGGT1_200010', 1)
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(60_000) // Wait for the gene model to render. It would be better to ensure some element of the canvas is actually there

    // Wait for the Job list drwaer to disappear so we don't affect the size of the image
    // cy.get('input[value="JobList"]', { timeout: 60_000 }).should('not.exist')

    cy.get('canvas[data-testid="overlayCanvas"]').compareSnapshot('gene-model')
  })
})
