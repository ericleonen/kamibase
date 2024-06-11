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

    /**
     * Returns the string representation of a Kami: a comma-separated list of Creases
     */
    public toString(): string {
        const list: Crease[] = this.creases.toList();

        return list
            .toSorted((left: Crease, right: Crease) => left.compareTo(right))
            .map(crease => crease.toString())
            .join(", ");
    }

    /**
     * Reads a KamiString in standard format and returns the corresponding Kami object.
     * @param str KamiString in the format of "<crease>, <crease>,..."
     */
    public static fromString(str: string): Kami {
        return Kami.fromStringHelper(
            str.replaceAll(" ", ""), 
            new Kami()
        );
    }

    /**
     * Recursively reads and builds a Kami object's Vertexes and Creases from KamiString. Returns
     * the final Kami object.
     * @param str  KamiString in the format of "<crease>,<crease>,..." with no spaces
     * @param kami Kami object
     */
    private static fromStringHelper(str: string, kami: Kami): Kami {
        if (str.length === 0) return kami;
        
        // Check that the first character is a valid CreaseType
        const type = str.charAt(0);

        if (!["M", "V", "N"].includes(type)) { 
            throw new Error(`Invalid CreaseType: ${type}`);
        }

        // Read inside the brackets: "[" and "]"
        const endBracketIndex = str.indexOf("]");

        if (str.charAt(1) !== "[" || endBracketIndex < 0) {
            throw new Error(`Missing or incomplete brackets: "[" and "]"`);
        }

        // Read and create each Vertex
        let inParentheses = false;
        let commaIndex = -1;

        for (let i = 2; i < endBracketIndex; i++) {
            const ch = str.charAt(i);

            if (ch === "(") inParentheses = true;
            else if (ch === ")") inParentheses = false;
            else if (!inParentheses && ch === ",") {
                commaIndex = i;
                break;
            }
        }

        if (commaIndex === -1) {
            throw new Error("Crease vertexes must be separated by a comma");
        }

        const vertex1 = kami.vertexes.get(
            Vertex.fromString(str.substring(2, commaIndex))
        );
        const vertex2 = kami.vertexes.get(
            Vertex.fromString(str.substring(commaIndex + 1, endBracketIndex))
        );

        // Add crease to Kami
        kami.crease(vertex1, vertex2, type as CreaseType, false);

        if (endBracketIndex === str.length - 1) return kami;
        if (str.charAt(endBracketIndex + 1) !== ",") {
            throw new Error("Creases must be separated by commas")
        }

        return Kami.fromStringHelper(str.substring(endBracketIndex + 2), kami);
    }

    public crease(vertex1: Vertex, vertex2: Vertex, type: CreaseType, allowOverlap: boolean = true) {
        const newCrease = new Crease(vertex1, vertex2, type);

        // Check and handle overlaps and intersections
        for (let oldCrease of this.creases.toList()) {
            if (newCrease)
        }
    }
}