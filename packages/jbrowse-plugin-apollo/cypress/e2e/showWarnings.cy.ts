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

    cy.get('button[data-testid="track_menu_icon"]').click()
    cy.contains('Appearance').trigger('mouseover')
    cy.contains('Show both graphical and table display').click()
    cy.contains('cds07').rightclick()
    cy.contains('Edit feature details').click()
    cy.contains('Basic information')
      .parent()
      .within(() => {
        cy.get('input[value="16"]').type('{selectall}{backspace}4{enter}')
        cy.get('input[value="27"]').type('{selectall}{backspace}24{enter}')
      })
    cy.get('button[data-testid="zoom_out"]').click()

    cy.get('[data-testid="ErrorIcon"]', { timeout: 5000 }).should(
      'have.length',
      2,
    )
    cy.get('[data-testid="ErrorIcon"]', { timeout: 5000 })
      .last()
      .trigger('mouseover')
    cy.contains(/(internal stop codon)|(missing stop codon)/)

    // Fix the missing stop codon. Internal stop still expected
    cy.contains('Basic information')
      .parent()
      .within(() => {
        cy.get('input[value="24"]').type('{selectall}{backspace}27{enter}')
      })
    cy.get('button[data-testid="zoom_out"]').click()
    cy.reload()

    cy.get('[data-testid="ErrorIcon"]', { timeout: 5000 }).should(
      'have.length',
      1,
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
    cy.get('[data-testid="ErrorIcon"]', { timeout: 5000 }).should(
      'have.length',
      3,
    )

    // Hopefully the order of icons is stable
    let iconPos1: DOMRect
    let iconPos2: DOMRect
    let iconPos3: DOMRect
    cy.get('[data-testid="ErrorIcon"]')
      .eq(0)
      .parent()
      .then(($icon) => {
        iconPos1 = $icon[0].getBoundingClientRect()
      })
    cy.get('[data-testid="ErrorIcon"]')
      .eq(1)
      .parent()
      .then(($icon) => {
        iconPos2 = $icon[0].getBoundingClientRect()
      })
    cy.get('[data-testid="ErrorIcon"]')
      .eq(2)
      .parent()
      .then(($icon) => {
        iconPos3 = $icon[0].getBoundingClientRect()
      })

    /** From https://developer.mozilla.org/en-US/docs/Web/API/DOMRect/y:
     * > The y property of the DOMRect interface represents the y-coordinate of the rectangle,
     * > which is the vertical distance between the viewport's top edge and the rectangle's origin.
     * This means that icons in the bottom rows have *higher* y coord than icons in the top rows.
     */
    cy.get('body').should(() => {
      expect(iconPos1.x).to.be.lessThan(iconPos2.x)
      expect(iconPos1.x).to.be.lessThan(iconPos3.x)
      expect(iconPos1.y).to.be.lessThan(iconPos3.y)
      expect(iconPos1.y).to.be.greaterThan(iconPos2.y)
      expect(iconPos3.x).to.be.greaterThan(iconPos2.x)
      expect(iconPos3.y).to.be.greaterThan(iconPos2.y)
    })
  })
})
