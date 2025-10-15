import {default as fjs_stringify} from 'fast-json-stable-stringify';

export function stringify(obj) {
  const pretty = JSON.stringify(JSON.parse(fjs_stringify(obj)), null, 2);
  return pretty
}



