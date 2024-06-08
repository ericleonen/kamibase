import Vertex from "./Vertex";

/**
 * Represents a Crease between to Vertexes.
 */
export default class Crease {
    vertex1: Vertex;
    vertex2: Vertex;

    /**
     * Initializes a Crease object between two distinct Vertexes. If the given Vertexes are equal,
     * throws an Error.
     * @param vertex1 
     * @param vertex2 
     */
    constructor(vertex1: Vertex, vertex2: Vertex) {
        if (vertex1.equals(vertex2)) throw new Error("Creases need two distinct Vertexes.");
        else if (vertex1.compareTo(vertex2) > 0) {
            this.vertex2 = vertex1;
            this.vertex1 = vertex2;
        } else {
            this.vertex1 = vertex1;
            this.vertex2 = vertex2;
        }
    }
}