describe('Different ways of editing features', () => {
  beforeEach(() => {
    cy.deleteAssemblies()
    cy.loginAsGuest()
  })

  it.only('Can select region on rubber-band and zoom into it', () => {
    cy.viewport(1000, 1000)
    cy.addAssemblyFromGff('volvox_cy', 'test_data/space.gff3')
    cy.selectAssemblyToView('volvox_cy')
    cy.get('input[placeholder="Search for location"]').type(
      'ctgA:1..10000{enter}',
    )
    cy.get('[data-testid="rubberband_controls"]').trigger('mouseover')
    cy.get('[data-testid="rubberband_controls"]').trigger('mousedown', 100, 5)
    cy.get('[data-testid="rubberband_controls"]').trigger('mousemove', 200, 5)
    cy.get('[data-testid="rubberband_controls"]').trigger('mouseup', 200, 5, {
      force: true,
    })
    cy.intercept('POST', '/users/userLocation').as('done')
    cy.contains('Zoom to region').click()
    cy.wait('@done')
    cy.currentLocationEquals('ctgA', 1021, 2041, 10)
  })

  it('Can drag and move position', () => {
    cy.viewport(1000, 1000)
    cy.addAssemblyFromGff('volvox_cy', 'test_data/space.gff3')
    cy.selectAssemblyToView('volvox_cy')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('[data-testid="MinimizeIcon"]').eq(1).click()
    cy.get('input[placeholder="Search for location"]').type(
      'ctgA:9400..9600{enter}',
    )
    // cy.contains('Table').click()
    // cy.contains('Match5').click()
    // cy.get('[data-testid="MoreVertIcon"]').click()
    // cy.contains('Minimize track').click()
    // cy.get('[data-testid="MoreVertIcon"]').click()
    // cy.contains('Restore track').click()

    cy.get('[data-testid="overlayCanvas"]').then((canvas) => {
      cy.wrap(canvas).trigger('mouseover', 700, 10) //  .rightclick()
    })
    // cy.get('[class="css-17gfnt3-verticalGuidesContainer"]').children().eq(0).trigger('mousedown', 200, 30)
    // cy.get('[class="css-17gfnt3-verticalGuidesContainer"]').children().eq(0).trigger('mousemove', 900, 30)
    // cy.get('[class="css-17gfnt3-verticalGuidesContainer"]').children().eq(0).trigger('mouseup', 900, 30)

    // cy.get('[data-testid="trackContainer"]').children().eq(0).children().trigger('mousedown', 700, 30, { force: true })
    // cy.get('[data-testid="trackContainer"]').children().eq(0).children().trigger('mousemove', 900, 30, { force: true })
    // cy.get('[data-testid="trackContainer"]').children().eq(0).children().trigger('mouseup', 900, 30, { force: true })
    // .parent().parent().trigger('mouseover')
    // cy.get('[data-testid="canvas"]').parent().parent().trigger('mousedown', 580, 30)
    // cy.get('[data-testid="canvas"]').parent().parent().trigger('mousemove', 200, 30)
    // cy.get('[data-testid="canvas"]').parent().parent().trigger('mouseup', 200, 30)
  })

  it('Can edit feature via table editor', () => {
    cy.addAssemblyFromGff('volvox_cy', 'test_data/space.gff3')
    cy.selectAssemblyToView('volvox_cy')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('[data-testid="MinimizeIcon"]').eq(1).click()
    cy.get('input[placeholder="Search for location"]').type(
      'ctgA:9400..9600{enter}',
    )
    cy.contains('Table').click()

    cy.get('tbody')
      .contains('tr', 'Match5')
      .within(() => {
        cy.get('input[type="text"][value="EST_match"]').type('CDS{enter}', {
          force: true,
        })
        cy.contains('9520').within((td) => {
          cy.wrap(td).click()
          cy.wrap(td).clear()
          cy.wrap(td).type('9432')
        })
        cy.contains('9900').within((td) => {
          cy.wrap(td).click()
          cy.wrap(td).clear()
          cy.wrap(td).type('9567')
        })
      })
    cy.get('body').click(0, 0)
    // Check edit is done
    cy.reload()
    cy.get('tbody')
    cy.contains('9432')
    cy.contains('9567')
    cy.get('input[type="text"][value="CDS"]')
  })
})
