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

    /**
     * Returns a positive number if this Vertex is greater than the other Vertex, 0 if they are
     * equal, and a negative number otherwise. Vertexes are compared by x values first followed by
     * the y values.
     * @param other Vertex
     */
    public compareTo(other: Vertex): number {
        const xComparison = this.x.compareTo(other.x);
        
        return xComparison === 0 ? this.y.compareTo(other.y) : xComparison;
    }
}