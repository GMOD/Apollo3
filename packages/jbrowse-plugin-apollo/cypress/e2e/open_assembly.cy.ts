describe('Open Assembly', () => {
  it('Can open assembly', () => {
    cy.loginAsGuest('config.tmp.json')
    cy.contains('Select assembly to view', { timeout: 10000 })
    cy.get('input[data-testid="assembly-selector"]').parent().click()
    cy.contains('volvox_cy').click()
    cy.contains('Open').click()
    // It would be better to test that the screen contains "volvox_cy" somewhere (at the moment it doesn't)
    cy.get('input[placeholder="Search for location"][value="ctgA:1..50,001"]')
  })
})
