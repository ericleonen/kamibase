import { PRECISION } from "@/settings";

/**
 * Returns a rounded x to PRECISION decimal places.
 */
export function round(x: number): number {
    return Number(x.toFixed(PRECISION));
}

/**
 * Returns whether or not a is approximately equal to b according to specified level of PRECISION.
 */
export function approxEqual(a: number, b: number): boolean {
    return round(a - b) === 0;
}

/**
 * Returns whether or not x is between min and max (inclusive). If min > max, throws an Error.
 */
export function inBetween(x: number, min: number, max: number): boolean {
    if (min > max) {
        throw new Error("min cannot be greater than max");
    }

    return min <= x && x <= max;
}