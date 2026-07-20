/** A typed success or expected failure at a business-logic boundary. */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export function mapResult<T, U, E>(result: Result<T, E>, map: (value: T) => U): Result<U, E> {
  return result.ok ? ok(map(result.value)) : err(result.error);
}

export function flatMap<T, U, E>(
  result: Result<T, E>,
  map: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? map(result.value) : err(result.error);
}
