import Crease, { CreaseType } from "../Crease";
import Vertex from "../Vertex";
import GeometrySet from "../GeometrySet";

/**
 * Represents a Kami (origami paper) with all of its Vertexes and Creases.
 */
export default class Kami {
    vertexes: GeometrySet<Vertex>;
    creases: GeometrySet<Crease>

    /**
     * Initializes a Kami object with (optionally) preset Vertexes and Creases.
     * @param vertexes Optional Vertex array
     * @param creases Optional crease array
     */
    constructor(vertexes: Vertex[] = [], creases: Crease[] = []) {
        this.vertexes = new GeometrySet<Vertex>(vertexes);
        this.creases = new GeometrySet<Crease>(creases);
    }

    public static fromString(str: string): Kami {
        const kami = new Kami();

        for (let creaseStr of str.split("\n")) {
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

    private creaseHelper(newCrease: Crease, oldCreases: Crease[]) {
        const oldCrease = oldCreases.shift();

        if (!oldCrease) {
            this.creases.add(newCrease);
            return;
        }

        const intersection = newCrease.getIntersectionWith(oldCrease);

        if (intersection) {
            this.vertexes.add(intersection);

            this.creases.remove(oldCrease);
            this.creases.add(...oldCrease.split(intersection));

            newCrease.split(intersection)
                .forEach(splitCrease => this.creaseHelper(splitCrease, oldCreases));
        } else if (oldCrease.contains(newCrease)) {
            this.creases.remove(oldCrease);

            if (!oldCrease.vertex1.equals(newCrease.vertex1)) {
                this.creases.add(new Crease(oldCrease.type, oldCrease.vertex1, newCrease.vertex1));
            }

            this.creases.add(newCrease);

            if (!newCrease.vertex2.equals(oldCrease.vertex2)) {
                this.creases.add(new Crease(oldCrease.type, newCrease.vertex2, oldCrease.vertex2));
            }
        } else if (newCrease.contains(oldCrease)) {
            oldCrease.type = newCrease.type;

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
                this.creases.remove(oldCrease);
                const [newCrease1, newCrease2] = newCrease.split(oldCrease.vertex1);
                
                this.creaseHelper(newCrease1, oldCreases);
    
                this.creases.add(
                    newCrease2,
                    new Crease(oldCrease.type, newCrease.vertex2, oldCrease.vertex2)
                );
    
            } else if (newCrease.contains(oldCrease.vertex2)) {
                this.creases.remove(oldCrease);
                const [newCrease1, newCrease2] = newCrease.split(oldCrease.vertex2);
    
                this.creases.add(
                    new Crease(oldCrease.type, oldCrease.vertex1, newCrease.vertex1),
                    newCrease1
                );
    
                this.creaseHelper(newCrease2, oldCreases);
            }
        } else {
            this.creaseHelper(newCrease, oldCreases);
        }

        oldCreases.unshift(oldCrease);
    }
}