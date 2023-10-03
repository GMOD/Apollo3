describe('Different ways of editing features', () => {
  beforeEach(() => {
    cy.deleteAssemblies()
    cy.loginAsGuest()
  })

  it('Edit feature via table editor', () => {
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

    cy.get('tbody', { timeout: 10_000 })
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
    cy.get('tbody', { timeout: 10_000 }).within(() => {
      cy.get('input[type="text"][value="CDS"]')
      cy.contains('9432')
      cy.contains('9567')
    })
  })

  it('Can add gene ontology attribute', () => {
    cy.addAssemblyFromGff('onegene.fasta.gff3', 'test_data/onegene.fasta.gff3')
    cy.selectAssemblyToView('onegene.fasta.gff3')
    cy.searchFeatures('gx1', 1)
    cy.contains('td', 'CDS1').rightclick()
    cy.contains('Edit attributes').click()
    cy.contains('Feature attributes')
      .parent()
      .within(() => {
        cy.contains('button', 'Add new').click()
        cy.get('input[value="Gene Ontology"]').click()
        cy.contains('button', /^Add$/).click()
        cy.contains('Gene Ontology')
          .parent()
          .parent()
          .parent()
          .within(() => {
            cy.get('input').type('quiescence')
          })
      })
    // This seems to take ~6 minutes in headless mode!
    cy.contains('li', 'GO:0044838', { timeout: 600_000 }).click()
    cy.contains('button', 'Submit changes').click()
    cy.contains('td', 'Gene Ontology=GO:0044838')
  })

  it('Can delete feature', () => {
    cy.addAssemblyFromGff('onegene.fasta.gff3', 'test_data/onegene.fasta.gff3')
    cy.selectAssemblyToView('onegene.fasta.gff3')
    cy.searchFeatures('gx1', 1)
    cy.contains('td', '=CDS1')
    cy.contains('td', '=tx1').rightclick()
    cy.contains('Delete feature').click()
    cy.contains('Are you sure you want to delete the selected feature?')
      .parent()
      .parent()
      .within(() => {
        cy.contains('button', /^yes$/, { matchCase: false }).click()
      })
    cy.contains('td', '=gx1')
    cy.contains('td', '=tx1').should('not.exist')
    cy.contains('td', '=CDS1').should('not.exist')
  })

  it('Suggest only valid SO terms from dropdown', () => {
    cy.addAssemblyFromGff('onegene.fasta.gff3', 'test_data/onegene.fasta.gff3')
    cy.selectAssemblyToView('onegene.fasta.gff3')
    cy.searchFeatures('gx1', 1)
    // In headless mode it seems to take a long time for menus to be populated
    cy.get('input[type="text"][value="CDS"]', { timeout: 60_000 }).click({
      timeout: 60_000,
      force: true,
    })
    cy.contains('li', /^start_codon$/, {
      timeout: 60_000,
      matchCase: false,
    }).should('exist')
    cy.contains('li', /^gene$/, { timeout: 60_000, matchCase: false }).should(
      'not.exist',
    )
  })

  it('Can add child feature via table editor', () => {
    cy.addAssemblyFromGff('onegene.fasta.gff3', 'test_data/onegene.fasta.gff3')
    cy.selectAssemblyToView('onegene.fasta.gff3')
    cy.searchFeatures('gx1', 1)
    // In headless mode it seems to take a long time for menus to be populated
    cy.get('input[type="text"][value="CDS"]', { timeout: 60_000 }).rightclick({
      timeout: 60_000,
      force: true,
    })
    cy.contains('Add child feature').click()
    cy.contains('Add new child feature')
      .parent()
      .within(() => {
        cy.get('form').within(() => {
          cy.contains('Start')
            .parent()
            .within(() => {
              cy.get('input').type('{selectall}{backspace}1')
            })
          cy.contains('End')
            .parent()
            .within(() => {
              cy.get('input').type('{selectall}{backspace}3')
            })
          cy.contains('Type')
            .parent()
            .within(() => {
              cy.get('input').click({ timeout: 60_000 })
            })
        })
      })
    cy.contains('li', /^start_codon$/, {
      timeout: 60_000,
      matchCase: false,
    }).click()
    cy.get('button').contains('Submit').click()
    cy.reload() // Ideally, you shouldn't need to reload to see the change?
    cy.get('tbody', { timeout: 60_000 }).within(() => {
      cy.get('input[value="start_codon"]').should('have.length', 1)
      cy.get('input[value="1"]').should('have.length', 4)
      cy.get('input[value="3"]').should('have.length', 1)
    })
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
