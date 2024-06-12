import Vertex from "../Vertex";

/**
 * Represents a Vector object with vector algrebraic operations.
 */
export default class Vector {
    x: number;
    y: number;

    /**
     * Initializes a Vector object <x, y>
     * @param x Horizontal number component
     * @param y Vertical number component
     */
    constructor(x: number, y: number) {
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
        return new Vector(this.x + other.x, this.y + other.y);
    }

    /**
     * Returns the Vector difference between this and the other Vector.
     * @param other Vector
     */
    public subtract(other: Vector) {
        return new Vector(this.x - other.x, this.y - other.y);
    }
}