describe('My First Test', () => {
  it('visits JBrowse', () => {
    // You can put JBrowse 2 into any session you want this way at the beginning
    // of your test!
    cy.fixture('hello_view.json').then((sessionData) => {
      cy.writeFile(
        '.jbrowse/hello_view.json',
        JSON.stringify(sessionData, null, 2),
      )
      cy.visit('/?config=hello_view.json')

      // The plugin successfully loads
      cy.contains('Hello plugin developers!')
    })
  })
})
