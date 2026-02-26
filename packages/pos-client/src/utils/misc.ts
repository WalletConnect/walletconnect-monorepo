/**
 * Creates a wrapper around an approval function that caches the result.
 * The approval is only executed once - subsequent calls return the cached result.
 */
export const createApprovalAwaiter = <T>(approval: () => Promise<T>) => {
  let cachedResult: T | undefined;
  let cachedPromise: Promise<T> | undefined;

  return async (): Promise<T> => {
    // If we already have a result, return it
    if (cachedResult !== undefined) {
      return cachedResult;
    }

    // If approval is already in progress, return the same promise
    if (cachedPromise) {
      return cachedPromise;
    }

    // Execute approval and cache both the promise and result
    cachedPromise = approval();
    cachedResult = await cachedPromise;
    return cachedResult;
  };
};
