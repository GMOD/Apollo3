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

    cy.visit('/?config=http://localhost:9000/jbrowse_config.json')
    cy.selectAssemblyToView('volvox.fasta.gff3')
    cy.searchFeatures('SpamGene')
    cy.contains('Error: Unknown reference sequence "SpamGene"')
  })

  it('Can use quotes to handle spaces', () => {
    cy.addAssemblyFromGff('space.gff3', 'test_data/space.gff3')
    cy.selectAssemblyToView('space.gff3')
    cy.searchFeatures('"agt A"')
    cy.currentLocationEquals('ctgA', 7500, 8000, 10)
  })

  it('FIXME: Can handle regex and space in attribute values', () => {
    cy.addAssemblyFromGff('space.gff3', 'test_data/space.gff3')
    cy.selectAssemblyToView('space.gff3')
    cy.get('input[placeholder="Search for location"]').type('Ma*.1{enter}')
    cy.contains('Search results')
    // It should instead either:
    // * Return only one hit for Match1, or
    // * Return 'Error: Unknown reference sequence'
  })
})
