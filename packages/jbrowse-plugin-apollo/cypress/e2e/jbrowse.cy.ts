describe('My First Test', () => {
  it('visits JBrowse', () => {
    cy.fixture('config.json').then((sessionData) => {
      cy.writeFile('.jbrowse/config.json', JSON.stringify(sessionData, null, 2))
      cy.visit('/')

      // The plugin successfully loads
      cy.contains('Select assembly to view')
    })
  })
})
