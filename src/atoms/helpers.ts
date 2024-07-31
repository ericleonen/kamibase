/**
 * Used when setting some of the fields of an object atom's state. Returns a function that accepts
 * the previous object state and returns a new object of the partial object's fields replacing the
 * previous object state.
 */
export function partial<T>(partialObject: Partial<T>): (prevObject: T) => T {
    return (prevObject: T) => ({ ...prevObject, partialObject });
}