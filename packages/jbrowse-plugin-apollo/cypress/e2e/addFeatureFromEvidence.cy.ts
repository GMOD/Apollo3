function canCreateApolloAnnotationFromEvidence() {
  cy.selectAssemblyToView('SM_V10_3.fasta.gff3.gz', 'SM_V10_3:323,000..330,000')
  cy.openAnnotationsTrack()

  // Add an evidence track pointing at a gff3 file that isn't part of the
  // Apollo annotations themselves
  cy.get('button').contains('File').click()
  cy.contains('Open track...').click()
  cy.contains('Add a track')
  cy.get('[data-testid="urlInput"]')
    .eq(0)
    .type('http://localhost:9000/test_data/SM_V10_3.sorted.gff3.gz')
  // The index file URL is inferred automatically; leave it as suggested
  cy.contains(
    'Found "SM_V10_3.sorted.gff3.gz.tbi" next to the main file and filled it in.',
  )
  cy.get('[data-testid="addTrackNextButton"]:visible').click()
  cy.get('[data-testid="trackNameInput"]').should(
    'have.value',
    'SM_V10_3.sorted.gff3.gz',
  )
  cy.get('[data-testid="addTrackNextButton"]:visible').click()

  cy.contains('Smp_093620', { timeout: 20_000 }).rightclick({
    force: true,
  })
  cy.contains('Create Apollo annotation').click()
  cy.contains('Create Apollo Annotation')
  cy.contains('gene - Smp_093620 (324611..327358)')
  cy.contains('button', 'Create').click()
  cy.get('[data-testid="snackbar-success"]').should(
    'contain',
    'Successfully copied selected gene and transcript(s)',
  )

  // Check the copied gene and mRNA actually ended up in the Apollo track.
  // Scope to the Annotations track's own header, since a second,
  // non-Apollo track (the evidence track) is also open and its track menu
  // doesn't have an "Appearance" submenu.
  cy.contains('Annotations (SM_V10_3.fasta.gff3.gz)')
    .closest('.MuiPaper-elevation1')
    .find('[data-testid="track_menu_icon"]')
    .click()
  cy.contains('Appearance').trigger('mouseover')
  cy.contains('Show both graphical and table display').click()
  cy.press(Cypress.Keyboard.Keys.ESC)
  cy.press(Cypress.Keyboard.Keys.ESC)

  cy.get('tbody', { timeout: 10_000 }).within(() => {
    cy.contains('td', 'Id=gene:Smp_093620')
      .parent()
      .within(() => {
        cy.contains('td', '324611')
        cy.contains('td', '327358')
      })
    cy.contains('td', 'Id=transcript:Smp_093620.1')
  })
}

describe('Add feature from evidence', () => {
  describe('using the collaboration server', () => {
    beforeEach(() => {
      cy.loginAsGuest()
    })
    afterEach(() => {
      cy.clearFeatures()
    })

    it('Can create an Apollo annotation from a feature in a gene track', () => {
      canCreateApolloAnnotationFromEvidence()
    })
  })

  describe('using local editing', () => {
    beforeEach(() => {
      cy.visitLocalSession()
    })
    afterEach(() => {
      cy.clearLocalFeatures()
    })

    it('Can create an Apollo annotation from a feature in a gene track', () => {
      canCreateApolloAnnotationFromEvidence()
    })
  })
})
