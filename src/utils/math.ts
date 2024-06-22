import { PRECISION } from "@/settings";

/**
 * Returns the canonically rounded version of x.
 * @param x A number
 */
export function round(x: number): number {
    return Number(x.toFixed(PRECISION));
}

/**
 * Returns true if numbers a and b are approximately equal, false otherwise.
 * @param a A number
 * @param b A number
 */
export function approxEqual(a: number, b: number): boolean {
    return round(a - b) === 0;
}

export function inBetween(x: number, min: number, max: number): boolean {
    return min <= x && min <= max;
}