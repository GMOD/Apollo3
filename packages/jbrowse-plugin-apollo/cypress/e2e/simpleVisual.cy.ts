describe('Simple tests for visuals', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })
  afterEach(() => {
    cy.deleteAssemblies()
  })
  it('Shows correct gene model', () => {
    cy.addAssemblyFromGff(
      'stopcodon.gff3',
      'test_data/cdsChecks/stopcodon.gff3',
    )
    cy.selectAssemblyToView('stopcodon.gff3')
    cy.searchFeatures('gene08', 1)
    cy.wait(5000) // Wait for the gene model to render. It would be better to ensure some element of the canvas is actually there

    cy.get('canvas[data-testid="overlayCanvas"]').compareSnapshot('gene-model')

    cy.get('canvas[data-testid="seqTrackOverlayCanvas"]').compareSnapshot(
      'sixframe',
    )
  })
})
