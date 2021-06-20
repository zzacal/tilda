import * as _ from 'lodash'
import { MockResponse } from '../types/mockResponse'
import { MockSetup } from '../types/mockSetup'
import { Record } from '../types/record'

export default class Store {
  private cache: Record[] = [];
  constructor() {
    this.cache = []
  }

  private getRecord(path: string, params?: any, body?: any) {
    return this.cache
      .filter((r) => r.path === path
        && _.isEqual(r.params, params)
        && _.isEqual(r.body, body))[0]
  }

  add(setup: MockSetup): Record {
    const { request, response } = setup
    const record = {
      path: request.path,
      params: request.params,
      body: request.body,
      response: response
    }

    const result = this.getRecord(setup.request.path, setup.request.params, setup.request.body);

    if (result) {
      result.response = setup.response;
    } else {
      this.cache.push(record)
    }

    return record
  }

  get(path: string, params?: any, body?: any): MockResponse | undefined {
    const result = this.getRecord(path, params, body);

    if (result) {
      return result.response;
    } else {
      console.warn("Warning: No setup found. Mock it.", `
        curl --location --request POST 'localhost:5111/mock' \\
        --header 'Content-Type: application/json' \\
        --data-raw '{
            "request": {
                "path": "${path}",
                "params": ${JSON.stringify(params)},
                "body": ${JSON.stringify(body)}
            },
            "response": {
                "type": "obj",
                "status": "200",
                "body": {}
            }
        }'
      `)
    }
    return;
  }

  // update(response: any, path: string, params?: any, body?: any): void {}

  // delete(path: string, params?: any, body?: any) {}
}
