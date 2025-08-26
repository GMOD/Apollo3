describe('Warning signs', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })
  afterEach(() => {
    cy.deleteAssemblies()
  })
  it('Show warnings', () => {
    cy.addAssemblyFromGff(
      'stopcodon.gff3',
      'test_data/cdsChecks/stopcodon.gff3',
    )
    cy.selectAssemblyToView('stopcodon.gff3')
    cy.searchFeatures('gene07', 1)

    // Here it would be nice to check that there are no ErrorIcons yet.
    // For this we need to make sure that the gene model is actually on the canvas,
    // which is not obvious how to do.
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.contains('cds07').rightclick()
    cy.contains('Edit feature details').click()
    cy.get('div[data-testid="basic_information"]')
      .parent()
      .within(() => {
        cy.get('input[value="16"]').type('{selectall}{backspace}4{enter}')
        cy.get('input[value="27"]').type('{selectall}{backspace}24{enter}')
      })
    cy.get('button[data-testid="zoom_out"]').click()

    cy.get('[data-testid^="ErrorIcon-"]', { timeout: 5000 }).should(
      'have.length',
      3,
    )
    cy.get('[data-testid="ErrorIcon-24"]', { timeout: 5000 }).trigger(
      'mouseover',
    )
    cy.contains(/Missing stop codon/)

    // Fix the missing stop codon. Internal stop still expected
    cy.get('div[data-testid="basic_information"]')
      .parent()
      .within(() => {
        cy.get('input[value="24"]').type('{selectall}{backspace}27{enter}')
      })
    cy.get('button[data-testid="zoom_out"]').click()
    cy.reload()

    cy.get('[data-testid^="ErrorIcon-"]', { timeout: 10_000 }).should(
      'have.length',
      2,
    )
  })
  it('Warnings are properly stacked', () => {
    cy.addAssemblyFromGff(
      'stopcodon.gff3',
      'test_data/cdsChecks/stopcodon.gff3',
    )
    cy.selectAssemblyToView('stopcodon.gff3')
    cy.searchFeatures('gene09', 1)

    cy.get('button[data-testid="zoom_out"]').click()
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(5000)
    cy.get('[data-testid^="ErrorIcon-"]', { timeout: 5000 }).should(
      'have.length',
      3,
    )

    let iconPos1: DOMRect
    let iconPos2: DOMRect
    let iconPos3: DOMRect
    cy.get('[data-testid="ErrorIcon-3"]')
      .parent()
      .then(($icon) => {
        iconPos1 = $icon[0].getBoundingClientRect()
      })
    cy.get('[data-testid="ErrorIcon-6"]')
      .parent()
      .then(($icon) => {
        iconPos2 = $icon[0].getBoundingClientRect()
      })
    cy.get('[data-testid="ErrorIcon-30"]')
      .parent()
      .then(($icon) => {
        iconPos3 = $icon[0].getBoundingClientRect()
      })

    /** From https://developer.mozilla.org/en-US/docs/Web/API/DOMRect/y:
     * The y property of the DOMRect interface represents the y-coordinate of the rectangle,
     * which is the vertical distance between the viewport's top edge and the rectangle's origin.
     * This means that icons in the bottom rows have *higher* y coord than icons in the top rows.
     */
    cy.get('body').should(() => {
      expect(iconPos1.y).to.be.lessThan(iconPos3.y)
      expect(iconPos1.y).to.be.greaterThan(iconPos2.y)
      expect(iconPos3.y).to.be.greaterThan(iconPos2.y)
    })
  })
})
