import Crease, { CreaseType } from "../Crease";
import Vertex from "../Vertex";
import GeometrySet from "../GeometrySet";
import { VERTEXES } from "../common";

/**
 * Represents a Kami (origami paper) with all of its Vertexes and Creases.
 */
export default class Kami {
    readonly vertexes: GeometrySet<Vertex>;
    readonly creases: GeometrySet<Crease>

    /**
     * Initializes a Kami object with (optionally) preset Vertexes and Creases.
     * @param vertexes Optional Vertex array
     * @param creases Optional crease array
     */
    constructor(vertexes: Vertex[] = [], creases: Crease[] = []) {
        const topLeft = VERTEXES["top left"].copy();
        const topRight = VERTEXES["top right"].copy();
        const bottomLeft = VERTEXES["bottom left"].copy();
        const bottomRight = VERTEXES["bottom right"].copy();

        const top = new Crease("B", topLeft, topRight);
        const right = new Crease("B", topRight, bottomRight);
        const bottom = new Crease("B", bottomRight, bottomLeft);
        const left = new Crease("B", bottomLeft, topLeft);

        topLeft.creases.add(top, left);
        topRight.creases.add(top, right);
        bottomLeft.creases.add(bottom, left);
        bottomRight.creases.add(bottom, right);

        this.vertexes = new GeometrySet<Vertex>([
            topLeft, topRight, bottomLeft, bottomRight,
            ...vertexes
        ]);
        this.creases = new GeometrySet<Crease>([
            top, right, bottom, left,
            ...creases
        ]);
    }

    /**
     * Returns the Kami object from reading the valid KamiString. If the KamiString is in an
     * invalid format, throws an Error.
     * @param str Valid KamiString. Each line represents a crease with format:
     *            "type x1 y1 x2 y2"
     */
    public static fromString(str: string): Kami {
        const kami = new Kami();

        for (let creaseStr of str.split("\n")) {
            creaseStr = creaseStr.trim();
            if (creaseStr.length === 0) continue;

            const creaseElems = creaseStr.split(" ");

            if (creaseElems.length !== 5) {
                throw new Error("Each line in a KamiFile must have 5 space-separated elements.");
            }

            const type = creaseElems.shift() as string;
            const [x1, y1, x2, y2]: number[] = creaseElems.map(numStr => Number(numStr));
            kami.crease(type, x1, y1, x2, y2);
        }

        return kami;
    }

    /**
     * Returns the String version of this Kami as a KamiString.
     */
    public toString(): string {
        return this.creases.toList(true)
            .map(crease => crease.toString())
            .join("\n");
    }

    /**
     * Creases the Kami as specified. If the crease is invalid, throws an Error.
     * @param type CreaseType
     * @param x1 X-coordinate of the first vertex
     * @param y1 Y-coordinate of the first vertex
     * @param x2 X-coordinate of the second vertex
     * @param y2 Y-coordinate of the second vertex
     */
    public crease(type: string, x1: number, y1: number, x2: number, y2: number) {
        if (!["M", "V", "N"].includes(type)) {
            throw new Error(`Invalid crease type: ${type}`);
        }

        const newCrease = new Crease(
            type as CreaseType,
            this.vertexes.get(new Vertex(x1, y1)),
            this.vertexes.get(new Vertex(x2, y2))
        );

        this.vertexes.add(
            newCrease.vertex1,
            newCrease.vertex2
        );

        this.creaseHelper(newCrease, this.creases.toList());
    }

    /**
     * Recursively alters the Kami object to reflect the current state of the Kami after making the
     * new Crease.
     * @param newCrease Crease
     * @param oldCreases Array of the Creases already in the Kami
     */
    private creaseHelper(newCrease: Crease, oldCreases: Crease[] = []) {
        if (oldCreases.length === 0) {
            this.creases.add(newCrease);
            newCrease.vertex1.creases.add(newCrease);
            newCrease.vertex2.creases.add(newCrease);
            return;
        }

        const oldCrease = oldCreases.shift()!;

        let intersection = newCrease.getIntersectionWith(oldCrease);

        if (intersection) {
            intersection = this.vertexes.get(intersection);

            this.eraseCrease(oldCrease, false);
            oldCrease.split(intersection).forEach(crease => this.creaseHelper(crease));

            newCrease.split(intersection)
                .forEach(splitCrease => this.creaseHelper(splitCrease, oldCreases));
        } else if (oldCrease.contains(newCrease)) {
            this.eraseCrease(oldCrease, false);

            if (!oldCrease.vertex1.equals(newCrease.vertex1)) {
                this.creaseHelper(new Crease(oldCrease.type, oldCrease.vertex1, newCrease.vertex1));
            }

            this.creaseHelper(newCrease);

            if (!newCrease.vertex2.equals(oldCrease.vertex2)) {
                this.creaseHelper(new Crease(oldCrease.type, newCrease.vertex2, oldCrease.vertex2));
            }
        } else if (newCrease.contains(oldCrease)) {
            this.eraseCrease(oldCrease, false);

            this.creaseHelper(new Crease(newCrease.type, oldCrease.vertex1, oldCrease.vertex2));

            if (!newCrease.vertex1.equals(oldCrease.vertex1)) {
                this.creaseHelper(
                    new Crease(newCrease.type, newCrease.vertex1, oldCrease.vertex1),
                    oldCreases
                );
            }

            if (!oldCrease.vertex2.equals(newCrease.vertex2)) {
                this.creaseHelper(
                    new Crease(newCrease.type, oldCrease.vertex2, newCrease.vertex2),
                    oldCreases
                );
            }
        } else if (newCrease.overlaps(oldCrease)) {

            if (newCrease.contains(oldCrease.vertex1)) {
                this.eraseCrease(oldCrease, false);
                const [newCrease1, newCrease2] = newCrease.split(oldCrease.vertex1);
                
                this.creaseHelper(newCrease1, oldCreases);
    
                this.creaseHelper(newCrease2);
                this.creaseHelper(new Crease(oldCrease.type, newCrease.vertex2, oldCrease.vertex2));
    
            } else if (newCrease.contains(oldCrease.vertex2)) {
                this.eraseCrease(oldCrease, false);
                const [newCrease1, newCrease2] = newCrease.split(oldCrease.vertex2);
    
                this.creaseHelper(new Crease(oldCrease.type, oldCrease.vertex1, newCrease.vertex1));
                this.creaseHelper(newCrease1);
    
                this.creaseHelper(newCrease2, oldCreases);
            }
        } else {
            this.creaseHelper(newCrease, oldCreases);
        }

        oldCreases.unshift(oldCrease);
    }

    /**
     * Erases a Crease from the Kami and optionally garbage collects any unused Vertexes.
     * @param crease 
     * @param eraseVertexes Optional boolean, default true
     */
    public eraseCrease(crease: Crease, eraseVertexes: boolean = true) {
        this.creases.remove(crease);

        crease.vertex1.creases.remove(crease);
        crease.vertex2.creases.remove(crease);

        if (eraseVertexes) {
            this.eraseVertex(crease.vertex1);
            this.eraseVertex(crease.vertex2);
        }
    }

    /**
     * Erases a Vertex from the Kami if the Vertex is not used by any Crease.
     * @param vertex Vertex
     */
    private eraseVertex(vertex: Vertex) {
        if (vertex.creases.isEmpty()) {
            this.vertexes.remove(vertex);
        } else if (vertex.creases.length() === 2) {
            const [crease1, crease2] = vertex.creases.toList(true);
            
            if (crease1.type === crease2.type && crease1.isParallelTo(crease2)) {
                const type = crease1.type;
                const [{vertex1}, {vertex2}] = [crease1, crease2];

                this.creaseHelper(new Crease(type, vertex1, vertex2));
                this.eraseCrease(crease1);
                this.eraseCrease(crease2);
            }
        }
    }
}