import Vertex from "../Vertex";

export type CreaseType = "M" | "V" | "N";

/**
 * Represents a Crease between to Vertexes.
 */
export default class Crease {
    vertex1: Vertex;
    vertex2: Vertex;
    type: CreaseType;

    /**
     * Initializes a Crease object between two distinct Vertexes with the given type. If the given
     * Vertexes are equal, throws an Error.
     * @param vertex1 Vertex
     * @param vertex2 Vertex
     * @param type CreaseType
     */
    constructor(vertex1: Vertex, vertex2: Vertex, type: CreaseType) {
        if (vertex1.equals(vertex2)) throw new Error("Creases need two distinct Vertexes.");
        else if (vertex1.compareTo(vertex2) > 0) {
            this.vertex2 = vertex1;
            this.vertex1 = vertex2;
        } else {
            this.vertex1 = vertex1;
            this.vertex2 = vertex2;
        }

        this.type = type;
    }

    /**
     * Returns the string representation of this Crease: "<type>[vertex1, vertex2]".
     */
    public toString(): string {
        return `${this.type}[${this.vertex1.toString()}, ${this.vertex2.toString()}]`;
    }

    /**
     * Returns a positive number if this Crease is greater than the other Crease, 0 if they are
     * equal, and a negative number otherwise. Creases are compared by vertex1 first followed by
     * the vertex2.
     * @param other Crease
     */
    public compareTo(other: Crease): number {
        const comparison1 = this.vertex1.compareTo(other.vertex1);
        
        return comparison1 === 0 ? this.vertex2.compareTo(other.vertex2) : comparison1;
    }

    /**
     * Reads a string and returns the Crease object of that string. If string is not in the
     * appropriate format, throws an Error.
     * @param str String in the form "<type>[vertex1, vertex2]"
     */
    public static fromString(str: string): Crease {
        str = str.trim();
        const type = str.charAt(0);

        if (
            ["M", "V", "N"].includes(type) 
                && str.charAt(1) === "[" 
                && str.charAt(str.length - 1) === "]"
        ) {
            const [vertex1, vertex2] = str
                .substring(2, str.length - 1)
                .split(",")
                .map(vertexStr => Vertex.fromString(vertexStr));

            return new Crease(vertex1, vertex2, type as CreaseType);
        } else {
            throw new Error(
                "Format is not <type>[vertex1, vertex2] where <type> is the CreaseType and vertex1 and" +
                " vertex2 are Vertexes"
            );
        }
    }
}