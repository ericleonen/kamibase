import { round } from "@/utils/math";
import Vector from "../Vector";
import Crease from "../Crease";
import Vertex from "../Vertex";

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
    public distance(other: Point | Crease): number {
        if (other instanceof Point) {
            return ((this.x - other.x) ** 2 + (this.y - other.y) ** 2) ** 0.5;
        } else { // other instanceof Crease
            const vertex = new Vertex(this.x, this.y);
            const vector1 = Vector.fromVertexes(other.vertex1, vertex);
            const vector2 = other.vector;

            const x = vector1.dot(vector2) / vector2.magnitude;

            if (x <= 0 || x >= vector2.magnitude) return Infinity;
            else return Math.sqrt(vector1.magnitude * vector1.magnitude - x * x);
        }
    }
}