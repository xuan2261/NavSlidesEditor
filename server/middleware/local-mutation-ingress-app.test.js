const request = require('supertest')
const { app } = require('../index')
const { LOCAL_MUTATION_INGRESS_DENIAL_CODE } = require('./local-mutation-ingress')

describe('production mutation ingress', () => {
  it('rejects hostile package imports before the upload route', async () => {
    const response = await request(app)
      .post('/api/pptx/import')
      .set('Host', 'attacker.example')
      .set('Origin', 'https://attacker.example')

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: 'Request denied',
      code: LOCAL_MUTATION_INGRESS_DENIAL_CODE,
    })
  })
})
