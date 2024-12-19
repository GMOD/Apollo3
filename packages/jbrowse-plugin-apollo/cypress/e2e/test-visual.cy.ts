describe('Add Assembly', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })
  afterEach(() => {
    cy.deleteAssemblies()
  })
  it('should compare screenshot of the entire page', () => {
    //   cy.visit('www.google.com')
    //   cy.compareSnapshot({
    //     name: 'home-page-with-threshold',
    //     testThreshold: 0.2
    //   })
  })
})
