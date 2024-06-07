import { gcd } from "@/utils/math";

/**
 * Represents a fraction. Able to perform all basic operations.
 */
export default class Fraction {
    n: number;
    d: number;

    /**
     * Initializes the fraction n/d. If d is 0, throws an Error.
     * @param n Numerator integer
     * @param d Non-zero denominator integer
     */
    constructor(n: number, d: number) {
        if (d == 0) throw new Error("d cannot be 0.");
        else if (d < 0) { // denominator should never be negative, only numerator (if ever)
            n *= -1;
            d *= -1;
        }

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

    /**
     * Returns the new Fraction sum of this and the other Fraction in simplest form.
     * @param other Fraction
     */
    public add(other: Fraction): Fraction {
        const sum = new Fraction(
            this.n * other.d + other.n * this.d,
            this.d * other.d
        );
        sum.simplify();

        return sum;
    }

    /**
     * Returns the new Fraction difference of this and the other Fraction in simplest form.
     * @param other Fraction
     */
    public subtract(other: Fraction): Fraction {
        const diff = new Fraction(
            this.n * other.d - other.n * this.d,
            this.d * other.d
        );
        diff.simplify();

        return diff;
    }

    /**
     * Returns the new Fraction product of this and the other Fraction in simplest form.
     * @param other Fraction
     */
    public multiply(other: Fraction): Fraction {
        const product = new Fraction(
            this.n * other.n,
            this.d * other.d
        );
        product.simplify();

        return product;
    }

    /**
     * Returns the new Fraction quotient of this and the other Fraction in simplest form. If the
     * other Fraction is 0, throws an Error.
     * @param other Fraction
     */
    public divide(other: Fraction): Fraction {
        if (other.n === 0) throw new Error("Cannot divide by 0.");

        const quotient = new Fraction(
            this.n * other.d,
            this.d * other.n
        );
        quotient.simplify();

        return quotient;
    }

    /**
     * Returns the new Fraction negative of this Fraction.
     */
    public negate(): Fraction {
        return new Fraction(this.n * -1, this.d);
    }
}