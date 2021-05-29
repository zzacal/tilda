import * as _ from 'lodash';
export default class Store {
  private cache: record[] = [];
  constructor() {}

  add(val: any, path: string, params?: any, body?: any): record {
    const record: record = { path, params, body, val };
    this.cache.push(record);
    return record;
  }

  get(path: string, params?: any, body?: any): record {
    return this.cache
      .filter((r) => r.path === path)
      .filter((r) => _.isEqual(r.params, params))
      .filter((r) => _.isEqual(r.body, body))[0];
  }

  // update(response: any, path: string, params?: any, body?: any): void {}

  // delete(path: string, params?: any, body?: any) {}

  clear() {
    this.cache = [];
  }
}

type record = {
  path: string;
  params: any;
  body: any;
  val: any;
};
