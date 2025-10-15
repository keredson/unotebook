import {default as fjs_stringify} from 'fast-json-stable-stringify';

export function stringify(obj) {
  const pretty = JSON.stringify(JSON.parse(fjs_stringify(obj)), null, 2);
  return pretty
}




function isTouchEnvironment() {
  // 1. Check for modern pointer API first
  if (window.matchMedia('(pointer: coarse)').matches) return true; // touch or pen
  if (window.matchMedia('(hover: hover)').matches) return false;   // mouse/trackpad

  // 2. Fallbacks for older browsers
  if ('ontouchstart' in window) return true;
  if (navigator.maxTouchPoints > 0) return true;
  if (navigator.msMaxTouchPoints > 0) return true;

  // Default to non-touch
  return false;
}

export const TOUCH_ENV = isTouchEnvironment();
console.log('Touch environment:', TOUCH_ENV);
