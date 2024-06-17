import { listKey } from "@/utils/string";
import Point from "../Point";
import Vector from "../Vector";
import Geometry from "../Geometry";
import GeometrySet from "../GeometrySet";
import Crease from "../Crease";

/**
 * Represents a physical point on the Kami.
 */
export default class Vertex extends Point implements Geometry {
    readonly creases: GeometrySet<Crease>;

    /**
     * Initializes a Vertex a distance x from the top and y from the left.
     * @param x number
     * @param y number
     */
    constructor(x: number, y: number) {
        super(x, y);

        this.creases = new GeometrySet<Crease>();
    }

    /**
     * Copies this Vertex and translates it by the given vector. Returns the new Vertex.
     * @param vector Vector
     */
    public translate(vector: Vector): Vertex {
        return new Vertex(this.x + vector.x, this.y + vector.y);
    }

    /**
     * Returns the GeometryKey of this Vertex.
     */
    public key(): string {
        return listKey(this.x, this.y);
    }
}