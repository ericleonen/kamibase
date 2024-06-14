import { round } from "@/utils/math";
import Vector from "../Vector";

/**
 * Represents a physical point in space.
 */
export default class Point {
    readonly x: number;
    readonly y: number;

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
     * Returns a positive number if this Point is greater than the other Point, 0 if they are
     * equal, and a negative number otherwise. Points are compared by x values first followed by
     * the y values.
     * @param other Point
     */
    public compareTo(other: Point): number {
        return round(this.x - other.x) || round(this.y - other.y);
    }

    /**
     * Returns True if this and the other Point are equal, false otherwise.
     * @param other Point
     */
    public equals(other: Point): boolean {
        return this.compareTo(other) === 0;
    }

    /**
     * Returns the Vector representation of this Point.
     */
    public toVector(): Vector {
        return new Vector(this.x, this.y);
    }

    /**
     * Returns the numerical Euclidean distance between this and the other Point.
     * @param other Point
     */
    public distance(other: Point) {
        return ((this.x - other.x) ** 2 + (this.y - other.y) ** 2) ** 0.5;
    }
}