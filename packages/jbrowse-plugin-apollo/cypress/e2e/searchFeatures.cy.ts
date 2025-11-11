describe('Search features', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })

  afterEach(() => {
    cy.deleteAssemblies()
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
    cy.currentLocationEquals('ctgA', 9444, 9976, 10)
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
    cy.selectAssemblyToView('volvox.fasta.gff3', 'Match6')
    cy.currentLocationEquals('ctgA', 7800, 9200, 10)
  })

  it('Match is not case sensitive', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.selectAssemblyToView('volvox.fasta.gff3', 'match6')
    cy.currentLocationEquals('ctgA', 7800, 9200, 10)
  })

  it('Decode URL escapes', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.selectAssemblyToView('volvox.fasta.gff3')
    cy.searchFeatures('Some%2CNote', 0)
    cy.searchFeatures('Some,Note', 1)
    cy.currentLocationEquals('ctgA', 800, 2200, 10)
  })

  it('One matching parent and multiple matching children', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.selectAssemblyToView('volvox.fasta.gff3', 'EDEN')
    cy.currentLocationEquals('ctgA', 1, 10_590, 10)
  })

  it('Search only the selected assembly', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.addAssemblyFromGff(
      'volvox2.fasta.gff3',
      'test_data/volvox2.fasta.gff3',
      false,
    )

    cy.selectAssemblyToView('volvox2.fasta.gff3', 'SpamGene')
    cy.currentLocationEquals('ctgA', 80, 220, 10)

    cy.visit('/?config=http://localhost:3999/jbrowse/config.json')
    cy.contains('Launch view', { timeout: 10_000 }).click()
    cy.selectAssemblyToView('volvox.fasta.gff3')
    cy.searchFeatures('SpamGene', 0)
  })

  it('Select from multiple hits', () => {
    cy.addAssemblyFromGff('volvox.fasta.gff3', 'test_data/volvox.fasta.gff3')
    cy.selectAssemblyToView('volvox.fasta.gff3')
    cy.searchFeatures('hga', 3)
    cy.contains('td', 'ctgA:1,000..2,000')
      .parent()
      .within(() => {
        cy.contains('button', /^Go$/, { matchCase: false }).click()
        cy.wait('@search hga')
      })
    cy.currentLocationEquals('ctgA', 1000, 2000, 10)

    cy.searchFeatures('hgb', 2)
  })

  it.only('Can handle regex and space in attribute values', () => {
    cy.addAssemblyFromGff('space.gff3', 'test_data/space.gff3')
    cy.selectAssemblyToView('space.gff3', 'Ma.*1')

    cy.searchFeatures('agt 2', 1)
    cy.currentLocationEquals('ctgA', 1, 8410, 10)

    cy.searchFeatures('spam"foo"eggs', 1)
    cy.currentLocationEquals('ctgA', 1, 8410, 10)

    cy.searchFeatures('agt B', 1)
    cy.currentLocationEquals('ctgA', 7800, 9200, 10)

    cy.searchFeatures('agt 1', 2)
  })
})
