import Crease from "./Crease";
import Vertex from "./Vertex";

/**
 * Represents a Kami (origami paper) with all of its Vertexes and Creases.
 */
export default class Kami {
    vertexes: Vertex[];
    creases: Crease[];

    /**
     * Initializes a Kami object with (optionally) preset Vertexes and Creases.
     * @param vertexes Optional Vertex array
     * @param creases Optional crease array
     */
    constructor(vertexes?: Vertex[], creases?: Crease[]) {
        this.vertexes = vertexes ?? [];
        this.creases = creases ?? [];
    }

    /**
     * Returns the string representation of a Kami: a comma-separated list of Creases
     */
    public toString(): string {
        this.creases.sort((left: Crease, right: Crease) => left.compareTo(right));

        return this.creases.map(crease => crease.toString()).join(", ");
    }
}