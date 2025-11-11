describe('Warning signs', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })
  afterEach(() => {
    cy.deleteAssemblies()
  })
  it('Navigate to feature from table editor', () => {
    cy.addAssemblyFromGff(
      'SM_V10_3.fasta.gff3.gz',
      'test_data/SM_V10_3.fasta.gff3.gz',
    )
    cy.selectAssemblyToView('SM_V10_3.fasta.gff3.gz', 'gene:Smp_313440')
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('td', 'exon:Smp_313440.1.1').dblclick({ force: true })
    cy.currentLocationEquals('SM_V10_3', 192_138, 192_275, 50)

    cy.contains('td', 'exon:Smp_313440.1.13').dblclick({ force: true })
    cy.currentLocationEquals('SM_V10_3', 206_893, 207_445, 100)

    // Test refseq boundaries
    cy.searchFeatures('SM_V10_3:800..2000', 1)
    cy.contains('td', 'region1').dblclick({ force: true })
    cy.currentLocationEquals('SM_V10_3', 1, 1300, 100)

    cy.searchFeatures('SM_V10_3:498000..499100', 1)
    cy.contains('td', 'region2').dblclick({ force: true })
    cy.currentLocationEquals('SM_V10_3', 498_900, 500_000, 100)
    cy.contains('500,000')
  })
})
