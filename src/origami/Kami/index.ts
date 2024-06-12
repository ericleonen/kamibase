import Crease, { CreaseType } from "../Crease";
import Vertex from "../Vertex";
import Set from "../Set";

/**
 * Represents a Kami (origami paper) with all of its Vertexes and Creases.
 */
export default class Kami {
    vertexes: Set<Vertex>;
    creases: Set<Crease>;

    /**
     * Initializes a Kami object with (optionally) preset Vertexes and Creases.
     * @param vertexes Optional Vertex array
     * @param creases Optional crease array
     */
    constructor(vertexes: Vertex[] = [], creases: Crease[] = []) {
        this.vertexes = new Set<Vertex>(vertexes);
        this.creases = new Set<Crease>(creases);
    }

    // public crease(vertex1: Vertex, vertex2: Vertex, type: CreaseType, allowOverlap: boolean = true) {
    //     const newCrease = new Crease(vertex1, vertex2, type);

    //     // Check and handle overlaps and intersections
    //     for (let oldCrease of this.creases.toList()) {
    //         if (newCrease)
    //     }
    // }
}