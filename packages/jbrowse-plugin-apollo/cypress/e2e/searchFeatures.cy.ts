describe('Search features', () => {
  beforeEach(() => {
    cy.deleteAssemblies()
    cy.loginAsGuest()
  })

  it.only('One hit, no children', () => {
    cy.addAssemblyFromGff('volvox_cy', 'test_data/volvox.fasta.gff3')
    cy.selectAssemblyToView('volvox_cy')
    cy.searchFeatures('Match6')
    cy.currentLocationEquals('ctgA', 8000, 9000, 10)
  })

  it('One matching Parent and multiple matching children', () => {
    cy.addAssemblyFromGff('volvox_cy', 'test_data/volvox.fasta.gff3')
    cy.selectAssemblyToView('volvox_cy')
    cy.searchFeatures('EDEN')
    cy.currentLocationEquals('ctgA', 1050, 9000, 10)
  })

  it('Search only the selected assembly', () => {
    cy.addAssemblyFromGff('volvox_cy', 'test_data/volvox.fasta.gff3')
    cy.addAssemblyFromGff('volvox_spam', 'test_data/volvox2.fasta.gff3')

    cy.selectAssemblyToView('volvox_spam')
    cy.searchFeatures('SpamGene')
    cy.currentLocationEquals('ctgA', 100, 200, 10)

    cy.fixture('config.json').then((config) => {
      cy.visit(config.apollo_url)
    })
    cy.selectAssemblyToView('volvox_cy')
    cy.searchFeatures('SpamGene')
    cy.contains('Error: Unknown reference sequence "SpamGene"')
  })

  it('Can handle space in attribute values', () => {
    cy.addAssemblyFromGff('volvox_cy', 'test_data/space.gff3')
    cy.selectAssemblyToView('volvox_cy')
    cy.searchFeatures('.1')
    cy.contains('Error: Unknown reference sequence')
  })
})
