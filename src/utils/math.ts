/**
 * Returns the GCD of the integers a and b. If a or b is not an integer throws an Error.
 * @param a An integer
 * @param b An integer
 */
export function gcd(a: number, b: number): number {
    if (Number.isInteger(a) && Number.isInteger(b)) {
        return b == 0 ? a : gcd(b, a % b);
    } else {
        throw new Error("a and b must be integers.");
    }
}