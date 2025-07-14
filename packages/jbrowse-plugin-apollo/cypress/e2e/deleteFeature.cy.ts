describe('Delete feature', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })

  afterEach(() => {
    cy.deleteAssemblies()
  })

  it('Delete and resize', () => {
    const assemblyName = 'deleteFeature.gff3'
    cy.addAssemblyFromGff(assemblyName, `test_data/${assemblyName}`)
    cy.selectAssemblyToView(assemblyName)

    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.get('input[placeholder="Search for location"]').type(
      'chr2:1..250{enter}',
    )

    // Delete this exon and check features are updated accordingly
    cy.contains('Id=exon01').rightclick({ force: true })
    cy.contains('Delete feature', { timeout: 10_000 }).click()
    cy.contains('button', 'Yes').click()

    cy.contains('Id=gene02')
      .parent()
      .within(() => {
        cy.get('input[value="10"]')
        cy.get('input[value="200"]')
      })

    cy.contains('Id=mrna02')
      .parent()
      .within(() => {
        cy.get('input[value="50"]')
      })

    cy.contains('Id=cds1')
      .parent()
      .within(() => {
        cy.get('input[value="50"]')
        cy.get('input[value="140"]')
      })

    cy.contains('Id=mrna03')
      .parent()
      .within(() => {
        cy.get('input[value="10"]')
        cy.get('input[value="190"]')
      })

    // Delete this other exon
    cy.contains('Id=exon05').rightclick({ force: true })
    cy.contains('Delete feature', { timeout: 10_000 }).click()
    cy.contains('button', 'Yes').click()

    cy.contains('Id=gene02')
      .parent()
      .within(() => {
        cy.get('input[value="50"]')
        cy.get('input[value="200"]')
      })
    cy.contains('Id=mrna03')
      .parent()
      .within(() => {
        cy.get('input[value="50"]')
        cy.get('input[value="190"]')
      })

    // Delete from right
    cy.contains('Id=exon09').rightclick({ force: true })
    cy.contains('Delete feature', { timeout: 10_000 }).click()
    cy.contains('button', 'Yes').click()

    cy.contains('Id=gene02')
      .parent()
      .within(() => {
        cy.get('input[value="50"]')
        cy.get('input[value="190"]')
      })

    cy.contains('Id=exon04').rightclick({ force: true })
    cy.contains('Delete feature', { timeout: 10_000 }).click()
    cy.contains('button', 'Yes').click()
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')

    cy.contains('Id=mrna02')
      .parent()
      .within(() => {
        cy.get('input[value="150"]')
      })

    cy.contains('Id=exon03').rightclick({ force: true })
    cy.contains('Delete feature', { timeout: 10_000 }).click()
    cy.contains('button', 'Yes').click()
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')

    cy.contains('Id=mrna02')
      .parent()
      .within(() => {
        cy.get('input[value="115"]')
      })

    cy.contains('Id=cds1')
      .parent()
      .within(() => {
        cy.get('input[value="115"]')
      })

    // No side effect in deleting "exon_region"
    cy.contains('Id=exon_region2').rightclick({ force: true })
    cy.contains('Delete feature', { timeout: 10_000 }).click()
    cy.contains('button', 'Yes').click()
    cy.contains('Id=exon_region1').rightclick({ force: true })
    cy.contains('Delete feature', { timeout: 10_000 }).click()
    cy.contains('button', 'Yes').click()
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')

    cy.contains('Id=exon08')
      .parent()
      .within(() => {
        cy.get('input[value="160"]')
        cy.get('input[value="190"]')
      })

    cy.contains('Id=cds1').rightclick({ force: true })
    cy.contains('Delete feature', { timeout: 10_000 }).click()
    cy.contains('button', 'Yes').click()
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')

    cy.contains('Id=mrna02')
      .parent()
      .within(() => {
        cy.get('input[value="50"]')
        cy.get('input[value="115"]')
      })

    cy.contains('Id=exon02').rightclick({ force: true })
    cy.contains('Delete feature', { timeout: 10_000 }).click()
    cy.contains('button', 'Yes').click()
    // Delete last exon: Do not delete or resize transcript
    cy.contains('Id=exon10').rightclick({ force: true })
    cy.contains('Delete feature', { timeout: 10_000 }).click()
    cy.contains('button', 'Yes').click()
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')

    cy.contains('Id=mrna02')
      .parent()
      .within(() => {
        cy.get('input[value="105"]')
        cy.get('input[value="115"]')
      })
  })

  it('Delete internal exon', () => {
    const assemblyName = 'deleteFeature.gff3'
    cy.addAssemblyFromGff(assemblyName, `test_data/${assemblyName}`)
    cy.selectAssemblyToView(assemblyName)

    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.get('input[placeholder="Search for location"]').type(
      'chr2:1..250{enter}',
    )

    cy.contains('Id=exon03').rightclick({ force: true })
    cy.contains('Delete feature', { timeout: 10_000 }).click()
    cy.contains('button', 'Yes').click()
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')

    cy.contains('Id=cds1')
      .parent()
      .within(() => {
        cy.get('input[value="115"]')
      })
  })

  it('Undo multiple ops', () => {
    const assemblyName = 'deleteFeature.gff3'
    cy.addAssemblyFromGff(assemblyName, `test_data/${assemblyName}`)
    cy.selectAssemblyToView(assemblyName)

    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.get('input[placeholder="Search for location"]').type(
      'chr2:1..250{enter}',
    )

    cy.contains('Id=exon01').rightclick({ force: true })
    cy.contains('Delete feature', { timeout: 10_000 }).click()
    cy.contains('button', 'Yes').click()
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')

    cy.contains('Id=cds1')
      .parent()
      .within(() => {
        cy.get('input[value="50"]')
      })

    cy.contains('Id=gene02')
      .parent()
      .within(() => {
        cy.get('input[value="10"]')
      })

    // Test UNDO
    // First undo restores only the sizes
    cy.selectFromApolloMenu('Undo')
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('Id=exon01').should('not.exist')
    cy.contains('Id=cds1')
      .parent()
      .within(() => {
        cy.get('input[value="20"]')
      })

    cy.contains('Id=gene02')
      .parent()
      .within(() => {
        cy.get('input[value="3"]')
      })

    // Second undo restores exon deletion
    cy.selectFromApolloMenu('Undo')
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('Id=exon01')

    cy.selectFromApolloMenu('Undo')
    cy.contains('No changes to undo')

    // Multiple deletions restored in a single undo
    cy.contains('Id=cds2')
    cy.contains('Id=exon06').rightclick({ force: true })
    cy.contains('Delete feature', { timeout: 10_000 }).click()
    cy.contains('button', 'Yes').click()
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('Id=cds2').should('not.exist')
    cy.contains('Id=exon06').should('not.exist')

    cy.selectFromApolloMenu('Undo')
    cy.annotationTrackAppearance('Show graphical display')
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('Id=exon06')
    cy.contains('Id=cds2')

    cy.selectFromApolloMenu('Undo')
    cy.contains('No changes to undo')
  })
})
