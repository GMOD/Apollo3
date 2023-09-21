describe('Different ways of editing features', () => {
  beforeEach(() => {
    cy.deleteAssemblies()
    cy.loginAsGuest()
  })

  it.skip('Can select region on rubber-band and zoom into it', () => {
    const assemblyName = 'space.gff3'
    cy.addAssemblyFromGff(assemblyName, `test_data/${assemblyName}`)
    cy.selectAssemblyToView(assemblyName)
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

  it('FIXME: edit feature via table editor', () => {
    const assemblyName = 'space.gff3'
    cy.addAssemblyFromGff(assemblyName, `test_data/${assemblyName}`)
    cy.selectAssemblyToView(assemblyName)

    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('[data-testid="MinimizeIcon"]').eq(1).click()
    cy.contains('Drawer minimized')
      .parent()
      .within(() => {
        cy.get('[data-testid="CloseIcon"]').click()
      })

    cy.contains('Table')
      .parent()
      .within(() => {
        cy.get('[data-testid]').then((el) => {
          const expandIcon: string = el.attr('data-testid') ?? ''
          if (expandIcon == 'ExpandLessIcon') {
            cy.log('Expanded')
          } else if (expandIcon == 'ExpandMoreIcon') {
            cy.contains('Table').click()
          } else {
            cy.log(`Unexpected value for expand icon: ${expandIcon}`)
          }
        })
      })

    cy.get('input[placeholder="Search for location"]').type(
      'ctgA:9400..9600{enter}',
    )

    cy.get('tbody')
      .contains('tr', 'Match5')
      .within(() => {
        cy.get('input[type="text"][value="EST_match"]').type('CDS{enter}', {
          force: true,
        })
        cy.contains('td', '9520').within(() => {
          cy.get('input').type('{selectall}{backspace}9432')
        })
        cy.contains('td', '9900').within(() => {
          cy.get('input').type('{selectall}{backspace}9567')
        })
      })
    cy.get('body').click(0, 0)
    // Check edit is done
    cy.reload()
    cy.get('tbody').within(() => {
      cy.get('input[type="text"][value="CDS"]')
      cy.contains('9432')
      // FIXME: It *should* contain 9567
      cy.contains('9567').should('not.exist')
    })
  })

  it.skip('Can drag and move position', () => {
    const assemblyName = 'space.gff3'
    cy.addAssemblyFromGff(assemblyName, `test_data/${assemblyName}`)
    cy.selectAssemblyToView(assemblyName)
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
})
