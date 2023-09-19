describe('Search features', () => {
  beforeEach(() => {
    cy.deleteAssemblies()
    cy.loginAsGuest()
  })

  it('One hit, no children', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.selectAssemblyToView('volvox.fasta.gff3')
    cy.searchFeatures('Match6')
    cy.currentLocationEquals('ctgA', 8000, 9000, 10)
  })

  it('One matching Parent and multiple matching children', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.selectAssemblyToView('volvox.fasta.gff3')
    cy.searchFeatures('EDEN')
    cy.currentLocationEquals('ctgA', 1050, 9000, 10)
  })

  it('Search only the selected assembly', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.addAssemblyFromGff('volvox2.fasta.gff3', 'test_data/volvox2.fasta.gff3')

    cy.selectAssemblyToView('volvox2.fasta.gff3')
    cy.searchFeatures('SpamGene')
    cy.currentLocationEquals('ctgA', 100, 200, 10)

    cy.fixture('config.json').then((config) => {
      cy.visit(config.apollo_url)
    })
    cy.selectAssemblyToView('volvox.fasta.gff3')
    cy.searchFeatures('SpamGene')
    cy.contains('Error: Unknown reference sequence "SpamGene"')
  })

  it('FIXME: Can handle space in attribute values', () => {
    cy.addAssemblyFromGff('space.gff3', 'test_data/space.gff3')
    cy.selectAssemblyToView('space.gff3')
    cy.searchFeatures('.1')
    cy.contains('Error: Unknown reference sequence')
  })
})
