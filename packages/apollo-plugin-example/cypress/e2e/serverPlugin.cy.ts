// Exercises the server half directly, without the UI: the custom route, and
// ExampleNoteLengthRule rejecting a change on the server
function notesPath(featureId: string) {
  return `/plugin-routes/apollo-plugin-example/features/${featureId}/notes`
}

describe('Example plugin server half', () => {
  beforeEach(() => {
    cy.setupJBrowseConfig()
    cy.loginAsGuest()
    cy.addAssemblyFromGff('example', 'cypress/fixtures/example.fasta.gff3')
  })

  afterEach(() => {
    cy.deleteAssemblies()
  })

  it('Serves a feature’s notes from the custom route', () => {
    cy.getFeature('longnotegene01').then(({ _id, attributes }) => {
      const featureId = _id.toHexString()
      cy.apolloRequest('GET', notesPath(featureId)).then((response) => {
        expect(response.status).to.equal(200)
        expect(response.body).to.deep.equal({
          featureId,
          notes: attributes?.note,
        })
      })
    })
    cy.apolloRequest('GET', notesPath('000000000000000000000000'))
      .its('status')
      .should('equal', 404)
  })

  it('Requires a logged-in user for the custom route', () => {
    cy.getFeature('gene01').then(({ _id }) => {
      cy.request({
        url: `http://localhost:3999${notesPath(_id.toHexString())}`,
        failOnStatusCode: false,
      })
        .its('status')
        .should('equal', 403)
    })
  })

  it('Rejects a note that is too long on the server', () => {
    // The UI won't let a note this long be typed, so send the change directly
    cy.getFeature('gene01').then(({ _id }) => {
      const featureId = _id.toHexString()
      // cypress-mongodb doesn't type the documents it finds
      ;(
        cy.findOne(
          { name: 'example' },
          { collection: 'assemblies' },
        ) as unknown as Cypress.Chainable<Cypress.ApolloDocument>
      ).then((assembly) => {
        const change = {
          typeName: 'ExampleNotesChange',
          assembly: assembly._id.toHexString(),
          changedIds: [featureId],
          featureId,
          oldNotes: [],
          newNotes: ['x'.repeat(201)],
        }
        cy.apolloRequest<{ message: string }>('POST', '/changes', change).then(
          (response) => {
            expect(response.status).to.equal(422)
            expect(response.body.message).to.contain(
              'Notes can be at most 200 characters long',
            )
          },
        )
        cy.getFeature('gene01').its('attributes.note').should('not.exist')

        // A note of an allowed length goes through
        cy.apolloRequest('POST', '/changes', {
          ...change,
          newNotes: ['x'.repeat(200)],
        })
          .its('status')
          .should('equal', 201)
        cy.getFeature('gene01')
          .its('attributes.note')
          .should('deep.equal', ['x'.repeat(200)])
      })
    })
  })
})
