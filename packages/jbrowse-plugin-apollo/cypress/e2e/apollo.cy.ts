describe('Apollo', () => {
  it('Can add assembly', () => {
    /* This completes fine but it doesn't really add a new assembly in mongodb (!?) */
    cy.fixture('tmp.json').then((config) => {
      cy.visit(config.apollo_url)
      cy.contains('Continue as Guest').click()
      cy.reload()
      cy.contains('Apollo').click()
      cy.contains('Add Assembly').click()
      cy.get('input[type="TextField"]').type('volvox3')
      cy.get('[value="text/x-fasta"]').check()
      cy.get('input[type="file"]').selectFile('test_data/volvox.2bit')
      cy.contains('Submit').click()
      cy.reload()
    })
  })

  it('Can open assembly', () => {
    /* This fails as it doesn't select any assembly */
    cy.fixture('tmp.json').then((config) => {
      cy.visit(config.apollo_url)
      cy.contains('Continue as Guest').click()
      cy.reload()
      cy.get('input[data-testid="assembly-selector"]').type('volvox_del')
    })
  })
})

/*
describe('My First Test', () => {
  it('visits JBrowse with Apollo', () => {
    // You can put JBrowse 2 into any session you want this way at the beginning
    // of your test!
    cy.fixture('apollo_view.json').then((sessionData) => {
      cy.writeFile(
        '.jbrowse/apollo_view.json',
        JSON.stringify(sessionData, null, 2),
      )
      cy.visit('/?config=apollo_view.json')

      // The plugin successfully loads
      cy.contains('Log in to Demo Server')
    })
  })
}) */
