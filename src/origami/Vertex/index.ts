import Vector from "../Vector";

/**
 * Represents a physical point on the Kami.
 */
export default class Vertex {
    x: number;
    y: number;

    /**
     * Initializes a Vertex a distance x from the top and y from the left.
     * @param x number
     * @param y number
     */
    constructor(x: number, y: number) {
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
        return this.x - other.x || this.y - other.y;
    }

    /**
     * Returns True if this and the other Vertex are equal, false otherwise.
     * @param other Vertex
     */
    public equals(other: Vertex): boolean {
        return this.compareTo(other) === 0;
    }

    public toVector(): Vector {
        return new Vector(this.x, this.y);
    }
}