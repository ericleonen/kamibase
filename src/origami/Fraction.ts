import { gcd } from "@/utils/math";

/**
 * Represents a fraction. Able to perform all basic operations.
 */
export default class Fraction {
    n: number;
    d: number;

    /**
     * Initializes the fraction n/d.
     * @param n Numerator integer
     * @param d Denominator integer
     */
    constructor(n: number, d: number) {
        this.n = n;
        this.d = d;
    }

    /**
     * Reads a string and returns the Fraction object of that string. If string is not in the
     * appropriate format, throws an Error.
     * @param str String in the form "n/d"
     */
    public static fromString(str: string): Fraction {
        const numStrs = str.split("/");

        if (numStrs.length !== 2) throw new Error("There is not exactly one /.");

        const [n, d] = numStrs.map(numStr => {
            const num = Number(numStr);

            if (Number.isInteger(num)) return num;
            else throw new Error("Format is not n/d where n and d are integers.")
        });

        return new Fraction(n, d);
    }

    /**
     * Simplifies the Fraction's numerator and denominator.
     */
    public simplify() {
        const g = gcd(this.n, this.d);

        this.n /= g;
        this.d /= g;
    }
}