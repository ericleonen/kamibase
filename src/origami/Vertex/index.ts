import { listKey } from "@/utils/string";
import Point from "../Point";
import Vector from "../Vector";

/**
 * Represents a physical point on the Kami.
 */
export default class Vertex extends Point {
    key: string;

    /**
     * Initializes a Vertex a distance x from the top and y from the left.
     * @param x number
     * @param y number
     */
    constructor(x: number, y: number) {
        super(x, y);
        this.key = listKey(x, y);
    }

    /**
     * Copies this Vertex and translates it by the given vector. Returns the new Vertex.
     * @param vector Vector
     */
    public translate(vector: Vector): Vertex {
        return new Vertex(this.x + vector.x, this.y + vector.y);
    }
}