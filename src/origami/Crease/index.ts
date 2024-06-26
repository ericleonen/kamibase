import { approxEqual, round } from "@/utils/math";
import Vector from "../Vector";
import Vertex from "../Vertex";
import { listKey } from "@/utils/string";
import Geometry from "../Geometry";
import Point from "../Point";
import { CreaseAction } from "../ProcessManager/types";

export type CreaseType = "M" | "V" | "N" | "B";

/**
 * Represents a Crease between to Vertexes.
 */
export default class Crease implements Geometry {
    readonly vertex1: Vertex;
    readonly vertex2: Vertex;
    readonly type: CreaseType;
    readonly vector: Vector;
    readonly length: number;

    /**
     * Initializes a Crease object between two distinct Vertexes with the given type. If the given
     * Vertexes are equal, throws an Error.
     */
    constructor(type: CreaseType, vertex1: Vertex, vertex2: Vertex) {
        if (vertex1.equals(vertex2)) throw new Error("Creases need two distinct Vertexes.");
        else if (vertex1.compareTo(vertex2) > 0) {
            this.vertex2 = vertex1;
            this.vertex1 = vertex2;
        } else {
            this.vertex1 = vertex1;
            this.vertex2 = vertex2;
        }

        this.type = type;
        this.vector = Vector.fromVertexes(this.vertex1, this.vertex2);
        this.length = this.vertex1.distance(this.vertex2);
    }

    /**
     * Reads a string and returns the corresponding Crease. String must be in the format:
     * "type x1 y1 x2 y2". ONLY USE FOR TESTING.
     */
    public static fromString(str: string): Crease {
        let [type, x1, y1, x2, y2] = str.split(" ");
        
        return new Crease(
            type as CreaseType,
            new Vertex(Number(x1), Number(y1)),
            new Vertex(Number(x2), Number(y2))
        );
    }

    /**
     * Returns a positive number if this Crease is greater than the other Crease, 0 if they are
     * equal, and a negative number otherwise. Creases are compared by vertex1 first followed by
     * the vertex2.
     */
    public compareTo(other: Crease): number {
        return round(this.vertex1.compareTo(other.vertex1))
            || round(this.vertex2.compareTo(other.vertex2));
    }

    /**
     * Returns true if this and the other Crease are equal, false otherwise.
     */
    public equals(other: Crease): boolean {
        return this.compareTo(other) === 0;
    }

    /**
     * Returns true if this Crease contains the given Vertex or Crease.
     */
    public contains(other: Vertex | Crease): boolean {
        if (other instanceof Vertex) {
            const dist1 = this.vertex1.distance(other);
            const dist2 = this.vertex2.distance(other);

            return approxEqual(dist1 + dist2, this.length);
        } else {
            return this.contains(other.vertex1) && this.contains(other.vertex2);
        }
    }

    /**
     * Returns true if this and the other Crease are parallel, false otherwise.
     */
    public isParallelTo(other: Crease): boolean {
        return this.vector.isParallelTo(other.vector);
    }

    /**
     * Returns the Vertex intersection of this and the other Crease. If there is not intersection,
     * returns undefined.
     */
    public getIntersectionWith(other: Crease): Vertex | undefined {
        if (this.isParallelTo(other)) return;

        const dx = other.vertex1.x - this.vertex1.x;
        const dy = other.vertex1.y - this.vertex1.y;
        const det = this.vector.x * other.vector.y - this.vector.y * other.vector.x;

        const s = (other.vector.y * dx - other.vector.x * dy) / det;
        const t = (this.vector.y * dx - this.vector.x * dy) / det;

        if (
            (approxEqual(t, 0) || approxEqual(t, 1))
            && (approxEqual(s, 0) || approxEqual(s, 1))
        ) {
            // Ignore vertex to vertex intersections
            return;
        } else if (round(Math.min(t, s)) >= 0 && round(1 - Math.max(t, s)) >= 0) {
            return this.vertex1.translate(this.vector.scale(s));
        }
    }

    /**
     * Splits this Crease on the given Vertex and returns the resulting Crease(s). If the Vertex is
     * not on the Crease, throws an Error.
     */
    public split(vertex: Vertex): Crease[] {
        if (!this.contains(vertex)) {
            throw new Error("Given vertex is not on Crease");
        } else if (vertex.equals(this.vertex1) || vertex.equals(this.vertex2)) {
            return [this];
        } else {
            return [
                new Crease(this.type, this.vertex1, vertex),
                new Crease(this.type, vertex, this.vertex2)
            ];
        }
    }

    /**
     * Returns the geometry key of this Crease.
     */
    public key(): string {
        return listKey(this.vertex1.key(), this.vertex2.key());
    }

    /**
     * Returns the String version of this Crease.
     */
    public toString(): string {
        return listKey(this.type, this.key());
    }

    /**
     * Converts and returns this Crease as a CreaseAction—either a crease or erase.
     */
    public toAction(name: "crease" | "erase"): CreaseAction {
        return {
            name,
            params: {
                type: this.type,
                x1: this.vertex1.x,
                y1: this.vertex1.y,
                x2: this.vertex2.x,
                y2: this.vertex2.y
            }
        };
    }

    /**
     * Returns the euclidean distance from this Crease to a point. If the point is "outside" the
     * Crease, returns Infinity.
     */
    public distanceToPoint(point: Point): number {
        const vertex = new Vertex(point.x, point.y);
        const vector1 = Vector.fromVertexes(this.vertex1, vertex);
        const vector2 = this.vector;

        const x = vector1.dot(vector2) / vector2.magnitude;

        if (x <= 0 || x >= vector2.magnitude) return Infinity;
        else return Math.sqrt(vector1.magnitude * vector1.magnitude - x * x);
    }
}