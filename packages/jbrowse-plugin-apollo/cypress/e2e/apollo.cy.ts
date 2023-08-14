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
})
