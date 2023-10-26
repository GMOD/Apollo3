describe('Search features', () => {
  beforeEach(() => {
    cy.deleteAssemblies()
    cy.loginAsGuest()
  })

  it('FIXME: Use of quotes', () => {
    cy.addAssemblyFromGff('space.gff3', 'test_data/space.gff3')
    cy.selectAssemblyToView('space.gff3')
    cy.searchFeatures('"agt A"', 4) // Should return 2 matches
  })

  it('FIXME: Inconsistent substring matching', () => {
    cy.addAssemblyFromGff('space.gff3', 'test_data/space.gff3')
    cy.selectAssemblyToView('space.gff3')

    cy.searchFeatures('transmem', 0)
    cy.searchFeatures('transmembrane', 1)
    cy.currentLocationEquals('ctgA', 9520, 9900, 10)
    cy.searchFeatures('7-transmembrane', 1)
    cy.searchFeatures('someKeyWord', 1)
    cy.searchFeatures('mRNA', 1)
    cy.searchFeatures('UTRs', 1)
    cy.searchFeatures('UTR', 1) // Why one match? Should be zero
    cy.searchFeatures('with', 0) // Why zero matches?
    cy.searchFeatures('both', 0) // Why zero matches?
    cy.searchFeatures('and', 0) // Why zero matches?
  })

  it('One hit with no children', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.selectAssemblyToView('volvox.fasta.gff3')
    cy.searchFeatures('Match6', 1)
    cy.currentLocationEquals('ctgA', 8000, 9000, 10)
  })

  it('Match is not case sensitive', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.selectAssemblyToView('volvox.fasta.gff3')
    cy.searchFeatures('match6', 1)
    cy.currentLocationEquals('ctgA', 8000, 9000, 10)
  })

  it('Decode URL escapes', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.selectAssemblyToView('volvox.fasta.gff3')
    cy.searchFeatures('Some%2CNote', 0)
    cy.searchFeatures('Some,Note', 1)
    cy.currentLocationEquals('ctgA', 1000, 2000, 10)
  })

  it('One matching parent and multiple matching children', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.selectAssemblyToView('volvox.fasta.gff3')
    cy.searchFeatures('EDEN', 1)
    cy.currentLocationEquals('ctgA', 1050, 9000, 10)
  })

  it('Search only the selected assembly', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.addAssemblyFromGff('volvox2.fasta.gff3', 'test_data/volvox2.fasta.gff3')

    cy.selectAssemblyToView('volvox2.fasta.gff3')
    cy.searchFeatures('SpamGene', 1)
    cy.currentLocationEquals('ctgA', 100, 200, 10)

    cy.visit('/?config=http://localhost:9000/jbrowse_config.json')
    cy.selectAssemblyToView('volvox.fasta.gff3')
    cy.searchFeatures('SpamGene', 0)
  })

  it('Select from multiple hits', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.selectAssemblyToView('volvox.fasta.gff3')
    cy.searchFeatures('hga', 3)
    cy.contains('td', 'ctgA:1000..2000')
      .parent()
      .within(() => {
        cy.contains('button', /^Go$/, { matchCase: false }).click()
        cy.wait('@search hga')
      })
    cy.currentLocationEquals('ctgA', 1000, 2000, 10)

    cy.searchFeatures('hgb', 2)
  })

  it('Can handle regex and space in attribute values', () => {
    cy.addAssemblyFromGff('space.gff3', 'test_data/space.gff3')
    cy.selectAssemblyToView('space.gff3')
    cy.searchFeatures('Ma.*1', 0)

    cy.searchFeatures('agt 2', 1)
    cy.currentLocationEquals('ctgA', 1150, 7200, 10)

    cy.searchFeatures('spam"foo"eggs', 1)
    cy.currentLocationEquals('ctgA', 1150, 7200, 10)

    cy.searchFeatures('agt B', 1)
    cy.currentLocationEquals('ctgA', 8000, 9000, 10)

    cy.searchFeatures('agt 1', 2)
  })
})
