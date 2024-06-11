import Fraction from "./Fraction";
import Vertex from "./Vertex";

/**
 * Represents a Vector object with vector algrebraic operations.
 */
export default class Vector {
    x: Fraction;
    y: Fraction;

    /**
     * Initializes a Vector object <x, y>
     * @param x Horizontal Fraction component
     * @param y Vertical Fraction component
     */
    constructor(x: Fraction, y: Fraction) {
        this.x = x;
        this.y = y;
    }

    /**
     * Returns Vector from the given tail Vertex to the head Vertex.
     * @param tail Vector
     * @param head Vector
     */
    public static fromVertexes(tail: Vertex, head: Vertex): Vector {
        return head.toVector().subtract(tail.toVector());
    }

    /**
     * Returns the Vector sum of this and the other Vector.
     * @param other Vector
     */
    public add(other: Vector) {
        return new Vector(this.x.add(other.x), this.y.add(other.y));
    }

    /**
     * Returns the Vector difference between this and the other Vector.
     * @param other Vector
     */
    public subtract(other: Vector) {
        return new Vector(this.x.subtract(other.x), this.y.subtract(other.y));
    }
}