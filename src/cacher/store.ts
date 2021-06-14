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
      .filter((r) => r.path === path)[0]
      // .filter((r) => _.isEqual(r.params, params))
      // .filter((r) => _.isEqual(r.body, body))
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

    if(result) {
      result.response = setup.response;
    } else {
      this.cache.push(record)
    }

    return record
  }

  get(path: string, params?: any, body?: any): MockResponse | undefined {
    console.log(`path: ${path}`)
    console.log(`params: ${JSON.stringify(body)}`)
    console.log(`body: ${JSON.stringify(body)}`)
    console.log(`cache:\n ${JSON.stringify(this.cache)}`)

    const result = this.getRecord(path, params, body);

    if (result) {
      return result.response;
    } else {
      console.log("Warning: No setup found. Mock it.", `
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
