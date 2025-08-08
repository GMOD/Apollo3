describe('Delete feature', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })

  afterEach(() => {
    cy.deleteAssemblies()
  })

  it('Merge multiple exons', () => {
    const assemblyName = 'mergeTranscripts.gff3'
    cy.addAssemblyFromGff(assemblyName, `test_data/${assemblyName}`)
    cy.selectAssemblyToView(assemblyName)

    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.get('input[placeholder="Search for location"]').type('chr2:1..60{enter}')

    cy.contains('Id=mrna03,')
    cy.contains('Id=mrna02').rightclick({ force: true })
    cy.contains('Merge transcripts', { timeout: 10_000 }).click()

    cy.contains('y [5-30]').within(() => {
      cy.get('input').click()
    })
    cy.contains('Submit').click()

    cy.contains('Id=mrna02')
      .parent()
      .within(() => {
        cy.contains('td', 3)
        cy.contains('td', 30)
        cy.contains('Id=mrna02, Name=x, merged_with=Id%3Dmrna03%3BName%3Dy')
      })
    cy.contains('Id=exon1')
      .parent()
      .within(() => {
        cy.contains('td', 3)
        cy.contains('td', 15)
        cy.contains(
          'Id=exon1, Name=a, Description=one, merged_with=Id%3Dexon3%3BName%3De%3BDescription%3Dtwo%2Cthree, Id%3Dexon6%3BName%3Daa%3BDescription%3Done1',
        )
      })
    cy.contains('Id=cds1')
      .parent()
      .within(() => {
        cy.contains('td', 4)
        cy.contains('td', 29)
        cy.contains(
          'Id=cds1, Name=c, d, merged_with=Id%3Dcds2%3BName%3Dh%2Ci%2Cj',
        )
      })
    cy.contains('Id=mrna03,').should('not.exist')

    cy.contains('Id=mrna02').rightclick({ force: true })
    cy.contains('Merge transcripts', { timeout: 10_000 }).click()
    cy.contains('mrna05 [26-40]').within(() => {
      cy.get('input').click()
    })
    cy.contains('Submit').click()
    cy.contains('Id=mrna05,').should('not.exist')

    cy.contains('Id=mrna02')
      .parent()
      .within(() => {
        cy.contains(
          'Id=mrna02, Name=x, merged_with=Id%3Dmrna03%3BName%3Dy, Id%3Dmrna05',
        )
      })
    cy.contains(
      'Id=exon2, Name=b, merged_with=Id%3Dexon5%3BName%3Dg, Id%3Dexon10',
    )

    // Close and reload to check that the server also has correct data
    cy.get('button[data-testid="close_view"]').click()
    cy.contains('Launch view') // To ensure that we reload after closing
    cy.reload()
    cy.contains('Launch view', { timeout: 10_000 }).click()
    cy.contains('Select assembly to view', { timeout: 10_000 })

    cy.selectAssemblyToView(assemblyName)
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.get('input[placeholder="Search for location"]').type('chr2:1..60{enter}')

    cy.contains(
      'Id=mrna02, Name=x, merged_with=Id%3Dmrna03%3BName%3Dy, Id%3Dmrna05',
    )
    cy.contains(
      'Id=exon2, Name=b, merged_with=Id%3Dexon5%3BName%3Dg, Id%3Dexon10',
    )
  })
})
