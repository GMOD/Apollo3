describe('Warning signs', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })
  afterEach(() => {
    cy.deleteAssemblies()
  })
  it('Lock session prevents editing', () => {
    cy.addAssemblyFromGff(
      'SM_V10_3.fasta.gff3.gz',
      'test_data/SM_V10_3.fasta.gff3.gz',
    )
    cy.selectAssemblyToView('SM_V10_3.fasta.gff3.gz')
    cy.searchFeatures('gene:Smp_313440', 1)
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.get('input[type="text"][value="192150"]')
      .first()
      .type('{selectall}{backspace}192140{enter}', {
        force: true,
      })
    // Refresh table editor
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')

    // Lock session
    cy.selectFromApolloMenu('Lock/Unlock session')
    cy.get('input[type="text"][value="192140"]')
      .first()
      .type('{selectall}{backspace}192130{enter}', {
        force: true,
      })
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('Cannot submit changes in locked mode')
    cy.contains('192140')
    cy.get('[data-testid="lock-icon"]').should('exist')

    // Unlock session
    cy.selectFromApolloMenu('Lock/Unlock session')
    cy.get('input[type="text"][value="192140"]')
      .first()
      .type('{selectall}{backspace}192130{enter}', {
        force: true,
      })
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('192130')
    cy.get('[data-testid="lock-icon"]').should('not.exist')
  })
})
