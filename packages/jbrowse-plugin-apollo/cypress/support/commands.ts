Cypress.Commands.add('loginAsGuest', () => {
  cy.visit('/?config=http://localhost:9000/jbrowse_config.json')
  cy.contains('Continue as Guest', { timeout: 10_000 }).click()
  // eslint-disable-next-line cypress/no-unnecessary-waiting
  cy.wait(2000)
  cy.reload()
})

Cypress.Commands.add('deleteAssemblies', () => {
  for (const x of ['assemblies', 'features']) {
    cy.log(x)
    cy.deleteMany({}, { collection: x }).then((results: undefined) => {
      cy.log(`Collection ${x}: ${results}` as unknown as string)
    })
  }
})

Cypress.Commands.add('addAssemblyFromGff', (assemblyName, fin) => {
  cy.get('button[data-testid="dropDownMenuButton"]', { timeout: 10_000 })
    .contains('Apollo')
    .click({ force: true, timeout: 10_000 })
  cy.contains('Add Assembly', { timeout: 10_000 }).click()
  cy.get('input[type="TextField"]').type(assemblyName)
  cy.get('input[value="text/x-gff3"]').check()
  cy.get('input[type="file"]').selectFile(fin)
  cy.get('[data-testid="CheckBoxIcon"]')
    .parent()
    .children()
    .get('input[type="checkbox"]')
    .should('be.checked')
  cy.intercept('/changes').as('changes')
  cy.get('button').contains('Submit').click()
  cy.wait('@changes').its('response.statusCode').should('match', /2../)

  cy.contains('UploadAssemblyFile')
    .parent()
    .should('contain', 'All operations successful')
  cy.contains('AddAssemblyAndFeaturesFromFileChange')
    .parent()
    .should('contain', 'All operations successful')
  // eslint-disable-next-line cypress/no-unnecessary-waiting
  cy.wait(1000)
  cy.reload()
  cy.get('button[aria-label="Close drawer"]', { timeout: 20_000 }).click()
  cy.contains('Select assembly to view', { timeout: 10_000 })
})

Cypress.Commands.add('selectAssemblyToView', (assemblyName) => {
  cy.contains('Select assembly to view', { timeout: 10_000 })

  cy.get('input[data-testid="assembly-selector"]')
    .parent()
    .then((el) => {
      if (el.text().includes(assemblyName) === false) {
        cy.get('input[data-testid="assembly-selector"]').parent().click()
        cy.get('li').contains(assemblyName).click()
      }
    })
  cy.intercept('POST', '/users/userLocation').as('selectAssemblyToViewDone')
  cy.contains('button', /^Open$/, { matchCase: false }).click()
  cy.wait('@selectAssemblyToViewDone')
})

Cypress.Commands.add('searchFeatures', (query, expectedNumOfHits) => {
  if (expectedNumOfHits < 0) {
    throw new Error(
      `Expected number of hits must be >= 0. Got: ${expectedNumOfHits}`,
    )
  }
  cy.intercept('POST', '/users/userLocation').as(`search ${query}`)
  cy.get('input[placeholder="Search for location"]').type(
    `{selectall}{backspace}${query}{enter}`,
  )
  if (expectedNumOfHits === 0) {
    cy.contains(`Error: Unknown reference sequence "${query}"`)
  } else if (expectedNumOfHits === 1) {
    cy.wait(`@search ${query}`)
  } else {
    cy.contains('Search results')
      .parent()
      .within(() => {
        cy.get('tbody')
          .find('tr')
          .then((rows) => {
            expect(rows.length).equal(expectedNumOfHits)
          })
      })
  }
})

Cypress.Commands.add('closeSearchBox', () => {
  cy.contains('Search results', { matchCase: false })
    .parent()
    .parent()
    .within(() => {
      cy.get('[data-testid="CloseIcon"]').click()
    })
})

Cypress.Commands.add(
  'currentLocationEquals',
  (contig, start, end, tolerance) => {
    cy.get('input[placeholder="Search for location"]')
      .invoke('val')
      .as('currentLocation')

    cy.get<string>('@currentLocation').should((currentLocation) => {
      const [xcontig, s, e] = currentLocation.split(/:|\.\./)
      const xstart: number = Number.parseInt(s.replace(',', ''), 10)
      const xend: number = Number.parseInt(e.replace(',', ''), 10)
      expect(xcontig).equal(contig)
      expect(xstart).to.be.within(start - tolerance, start + tolerance)
      expect(xend).to.be.within(end - tolerance, end + tolerance)
    })
  },
)

Cypress.Commands.add(
  'importFeatures',
  (gffFile, assemblyName, deleteExistingFeatures) => {
    cy.contains('button[data-testid="dropDownMenuButton"]', 'Apollo').click({
      timeout: 10_000,
    })
    cy.contains('Import Features').click()
    cy.contains('Import Features from GFF3 file', { matchCase: false })
      .parent()
      .within(() => {
        cy.contains('Upload GFF3 to load features', { matchCase: false })
          .parent()
          .within(() => {
            cy.get('input[type="file"]').selectFile(gffFile)
          })

        cy.contains('Select assembly')
          .parent()
          .within(() => {
            cy.get('input').parent().click()
          })
      })
    cy.contains('li', assemblyName, { timeout: 10_000 }).click()

    cy.contains('Yes, delete existing features')
      .parent()
      .within(() => {
        if (deleteExistingFeatures) {
          cy.get('input[type="checkbox"]').click()
          cy.get('input[type="checkbox"]').should('be.checked')
        } else {
          cy.get('input[type="checkbox"]').should('be.not.checked')
        }
      })

    cy.contains('button', 'Submit').click()
    cy.contains('Importing features for')
      .parent()
      .should('contain', 'All operations successful')
    cy.contains('AddFeaturesFromFileChange')
      .parent()
      .should('contain', 'All operations successful')
  },
)
