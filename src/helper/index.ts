/**
 * Recursively lowercase string keys on plain objects (but not inside arrays).
 *
 * Notes & caveats:
 * - Arrays are returned as-is (their elements are not traversed or altered).
 * - Non-plain objects (e.g., Date, Map, Set, class instances) are treated as generic objects:
 *   only their enumerable own properties (string keys) are considered; prototype/behavior is not preserved.
 * - Symbol keys are preserved and not lowercased (only string keys are transformed).
 * - At runtime, this creates a new plain object via Object.fromEntries; it does not mutate the input.
 */

/**
 * ObjectKeysToLowerCase<T>
 *
 * A conditional/recursive mapped type that:
 * - Leaves arrays unchanged.
 * - For object types, remaps each string key K to Lowercase<K> and recursively applies to nested objects.
 * - Leaves primitives unchanged.
 */
export type ObjectKeysToLowerCase<T> =
  // If T is an array type, leave it as-is
  T extends any[]
    ? T
    : // If T is an object (non-array), remap string keys to lowercase and recurse on values
      T extends object
      ? {
          [K in keyof T as K extends string
            ? Lowercase<K> // only lowercase string keys; keep non-string keys as-is
            : K]: T[K] extends any[]
            ? T[K] // arrays are left untouched
            : T[K] extends object
              ? ObjectKeysToLowerCase<T[K]> // recurse into nested objects
              : T[K]; // primitives unchanged
        }
      : // Otherwise (primitives), leave T unchanged
        T;

/**
 * convertObjectKeysToLowerCase
 *
 * Recursively transforms all **string** keys of a plain object to lowercase.
 * Arrays are returned unmodified and are not traversed.
 *
 * @example
 * const input = { Foo: 1, Bar: { BAZ: 2 }, list: [ { Keep: 'as-is' } ] };
 * const out = convertObjectKeysToLowerCase(input);
 * // out => { foo: 1, bar: { baz: 2 }, list: [ { Keep: 'as-is' } ] }
 *
 * @param obj - Any value; only non-null, non-array objects are transformed.
 * @returns A new object with lowercased string keys (shape typed via ObjectKeysToLowerCase<T>).
 */
export function convertObjectKeysToLowerCase<T>(
  obj: T
): ObjectKeysToLowerCase<T> {
  // Fast path: if not a non-null object OR it's an array, return as-is.
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj as ObjectKeysToLowerCase<T>;
  }

  // Convert enumerable own entries: lowercase string keys and recurse for nested plain objects.
  const entries = Object.entries(obj as Record<PropertyKey, unknown>).map(
    ([k, v]) => {
      // Only lowercase string keys; non-string (e.g., symbol) keys are kept unchanged.
      const newKey: PropertyKey = typeof k === 'string' ? k.toLowerCase() : k;

      // Recurse only for non-null, object, non-array values.
      const newVal =
        v !== null && typeof v === 'object' && !Array.isArray(v)
          ? convertObjectKeysToLowerCase(v)
          : v;

      return [newKey, newVal] as const;
    }
  );

  // Build a new plain object from transformed entries.
  return Object.fromEntries(entries) as ObjectKeysToLowerCase<T>;
}
