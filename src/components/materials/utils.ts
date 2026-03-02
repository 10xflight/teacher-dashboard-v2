/* eslint-disable @typescript-eslint/no-explicit-any */

/** Strip leading number prefixes like "1. ", "7. ", "12) " that the AI sometimes adds. */
export function stripLeadingNumber(text: string): string {
  if (!text) return text;
  return text.replace(/^\d+[\.\)]\s*/, '');
}

/** Immutably update a value at a nested path in an object. */
export function updateAtPath(obj: any, path: (string | number)[], value: any): any {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (typeof head === 'number') {
    const arr = Array.isArray(obj) ? [...obj] : [];
    arr[head] = updateAtPath(arr[head], rest, value);
    return arr;
  }
  return { ...obj, [head]: updateAtPath(obj?.[head], rest, value) };
}
