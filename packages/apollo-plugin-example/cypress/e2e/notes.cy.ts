// Exercises ExampleNotesChange end to end: the context menu items, the client
// handler (the UI updates), the server handler (MongoDB updates), and
// getInverse() (undo).
describe('Example plugin notes', () => {
  beforeEach(() => {
    cy.setupJBrowseConfig()
    cy.loginAsGuest()
    cy.addAssemblyFromGff('example', 'cypress/fixtures/example.fasta.gff3')
    cy.selectAssemblyToView('example', 'ctgA:1..700')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')
  })

  afterEach(() => {
    cy.deleteAssemblies()
  })

  it('Adds, clears, and undoes notes from the context menu', () => {
    cy.contains('Id=gene01').rightclick({ force: true })
    // "Clear notes" is only offered once the feature has notes
    cy.contains('li', 'Add note', { timeout: 10_000 })
    cy.contains('li', 'Clear notes').should('not.exist')
    cy.contains('li', 'Add note').click()
    cy.get('[role="dialog"]').within(() => {
      cy.get('textarea').first().type('Checked by hand')
      cy.contains('button', 'Add').click()
    })
    cy.contains('Notes updated')

    cy.getFeature('gene01')
      .its('attributes.note')
      .should('deep.equal', ['Checked by hand'])

    // The note is still there after a reload, so it came back from the server
    cy.reload()
    cy.contains('Id=gene01', { timeout: 10_000 }).rightclick({ force: true })
    cy.contains('li', 'Edit feature details').click()
    cy.contains('Checked by hand')

    cy.contains('Id=gene01').rightclick({ force: true })
    cy.contains('li', 'Clear notes').click()
    cy.contains('Notes updated')
    cy.getFeature('gene01').its('attributes.note').should('not.exist')

    // Undoing submits the inverse change, which puts the note back
    cy.selectFromApolloMenu('Undo')
    cy.getFeature('gene01')
      .its('attributes.note')
      .should('deep.equal', ['Checked by hand'])
  })

  it('Keeps an existing over-long note when editing notes', () => {
    // longnotegene01 is loaded with a 250-character note, which the length
    // rule allows to stay because the feature already had it
    const longNote = 'x'.repeat(250)
    cy.contains('Id=longnotegene01').rightclick({ force: true })
    cy.contains('li', 'Edit feature details').click()
    cy.contains('li', longNote).within(() => {
      cy.get('[data-testid="MoreHorizIcon"]').click()
    })
    cy.contains('li[role="menuitem"]', 'Edit').click()
    cy.contains('button', 'Add another note').click()
    cy.get('textarea:visible').last().type('A short note')
    cy.contains('button', 'Update').click()

    cy.getFeature('longnotegene01')
      .its('attributes.note')
      .should('deep.equal', [longNote, 'A short note'])
  })
})
