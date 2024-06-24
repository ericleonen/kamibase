import { approxEqual, round } from "@/utils/math";
import Vertex from "../Vertex";

/**
 * Represents a Vector object with vector algrebraic operations.
 */
export default class Vector {
    readonly x: number;
    readonly y: number;
    readonly magnitude: number;

    /**
     * Initializes a Vector object <x, y>.
     */
    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.magnitude = Math.sqrt(x * x + y * y);
    }

    /**
     * Returns Vector from the given tail Vertex to the head Vertex.
     */
    public static fromVertexes(tail: Vertex, head: Vertex): Vector {
        return head.toVector().subtract(tail.toVector());
    }

    /**
     * Returns the Vector sum of this and the other Vector.
     */
    public add(other: Vector) {
        return new Vector(this.x + other.x, this.y + other.y);
    }

    /**
     * Returns the Vector difference between this and the other Vector.
     */
    public subtract(other: Vector) {
        return new Vector(this.x - other.x, this.y - other.y);
    }

    /**
     * Returns this Vector scaled by the given constant.
     */
    public scale(c: number) {
        return new Vector(this.x * c, this.y * c);
    }

    /**
     * Returns true if this and the other Vector are parallel, false otherwise.
     */
    public isParallelTo(other: Vector) {
        return approxEqual(
            this.x * other.y,
            other.x * this.y
        );
    }

    /**
     * Returns a positive number if this Vector is greater than the other Vector, a negative number
     * otherwise.
     */
    public compareTo(other: Vector): number {
        return round(this.x - other.x) || round(this.y - other.y);
    }

    /**
     * Returns true if this and the other Vector are equal, false otherwise.
     */
    public equals(other: Vector): boolean {
        return this.compareTo(other) === 0;
    }

    /**
     * Returns the dot of this and the other Vector.
     */
    public dot(other: Vector): number {
        return this.x * other.x + this.y * other.y;
    }
}