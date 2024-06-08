import Fraction from "./Fraction";

/**
 * Represents a physical point on the Kami.
 */
export default class Vertex {
    x: Fraction;
    y: Fraction;

    /**
     * Initializes a Vertex a distance x from the top and y from the left.
     * @param x Fraction
     * @param y Fraction
     */
    constructor(x: Fraction, y: Fraction) {
        this.x = x;
        this.y = y;
    }
}