const apolloURL = 'http://localhost:3999'

describe('Real-time updates from other users', () => {
  beforeEach(() => {
    cy.loginAsGuest()
  })

  afterEach(() => {
    cy.deleteAssemblies()
  })

  it("Shows another user's feature edit without reloading", () => {
    const assemblyName = 'space.gff3'
    cy.addAssemblyFromGff(assemblyName, `test_data/${assemblyName}`)
    cy.selectAssemblyToView(assemblyName, 'ctgA:9400..9600')
    cy.contains('Open track selector').click()
    cy.contains('Annotations (').click()
    cy.get('button[aria-label="Minimize drawer"]').click()
    cy.annotationTrackAppearance('Show both graphical and table display')
    cy.get('tbody', { timeout: 10_000 })
      .contains('tr', 'Match5')
      .contains('td', '9900')

    // Another user changes the end of Match5 from 9900 to 9850
    cy.loginAsOtherGuest().then((token) => {
      const headers = { Authorization: `Bearer ${token}` }
      cy.request<{ _id: string; name: string }[]>({
        url: `${apolloURL}/assemblies`,
        headers,
      }).then(({ body: assemblies }) => {
        const assembly = assemblies.find((a) => a.name === assemblyName)
        if (!assembly) {
          throw new Error(`Assembly "${assemblyName}" not found`)
        }
        cy.request<{ _id: string; max: number }[]>({
          url: `${apolloURL}/features/searchFeatures`,
          qs: { term: 'Match5', assemblies: assembly._id },
          headers,
        }).then(({ body: [feature] }) => {
          cy.request({
            method: 'POST',
            url: `${apolloURL}/changes`,
            headers,
            body: {
              typeName: 'LocationEndChange',
              assembly: assembly._id,
              changedIds: [feature._id],
              featureId: feature._id,
              oldEnd: feature.max,
              newEnd: 9850,
            },
          })
        })
      })
    })

    // The change arrives over server-sent events, so no reload is needed
    cy.get('tbody', { timeout: 10_000 })
      .contains('tr', 'Match5')
      .within(() => {
        cy.contains('td', '9850')
        cy.contains('td', '9900').should('not.exist')
      })
  })
})
