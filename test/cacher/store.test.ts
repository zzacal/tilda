import Store from '../../src/cacher/store'
import { MockResponseType } from '../../src/types/mockResponse'
import { MockSetup } from '../../src/types/mockSetup'

describe('cache store', () => {
  const store = new Store()
  const val = 'some value'
  const path = '/'
  const params = 'some params'
  const body = 'some body'
  it('can add', () => {
    const setup: MockSetup = {
      request: {
        path,
        params,
        body
      },
      response: {
        type: MockResponseType.string,
        status: 200,
        body: val
      }
    }
    store.add(setup)
    const stored = store.get(path, params, body)

    expect(stored).toEqual(val)
  })
})
