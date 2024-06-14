import Crease from "../Crease";
import Geometry from "../Geometry";
import Vertex from "../Vertex";

/**
 * Represents a set of Geometry objects: Creases or Vertexes.
 */
export default class GeometrySet<T extends Geometry> {
    private map: { [key: string]: T };
    private size: number;

    /**
     * Initializes a GeometrySet object with an optional list of items.
     * @param items Optional list of Creases or Vertexes
     */
    constructor(items: T[] = []) {
        this.map = {};
        this.size = 0;

        for (let item of items) {
            if (!(item.key() in this.map)) {
                this.map[item.key()] = item;
                this.size += 1;
            }
        }
    }

    /**
     * Returns true if this GeometrySet has all items, false otherwise.
     * @param items Array of items
     */
    contains(...items: T[]): boolean {
        return items.every(item => {
            if (item instanceof Crease) {
                return item.key() in this.map
                    && (this.map[item.key()] as unknown as Crease).type == item.type;
            } else {
                return item.key() in this.map;
            }
        });
    }

    /**
     * Adds all of the given items to the GeometrySet.
     * @param items Array of items
     */
    add(...items: T[]) {
        items.forEach(item => {
            if (!this.contains(item)) {
                this.map[item.key()] = item; 
                this.size += 1;
            }
        });
    }

    /**
     * Removes item from the GeometrySet. If the item is not in the GeometrySet, does nothing.
     * @param item 
     */
    remove(item: T) {
        if (this.contains(item)) {
            delete this.map[item.key()];
            this.size -= 1;
        }
    }

    /**
     * Retrieves the equivalent item from the GeometrySet. If the item is not in the GeometrySet,
     * adds the item and returns it.
     * @param item 
     */
    get(item: T) {
        if (this.contains(item)) {
            return this.map[item.key()];
        } else {
            this.add(item);
            return item;
        }
    }

    /**
     * Returns an optionally sorted loopable array of this GeometrySet's items.
     * @param sorted Optional boolean that determines if the returned list is sorted
     */
    toList(sorted: boolean = false): T[] {
        const list = Object.values(this.map);

        if (sorted) {
            return list.toSorted((left: T, right: T) => {
                if (left instanceof Vertex && right instanceof Vertex) {
                    return left.compareTo(right);
                } else if (left instanceof Crease && right instanceof Crease) {
                    return left.compareTo(right);
                } else {
                    throw new Error("Cannot have both Vertexes and Creases in GeometrySet");
                }
            });
        } else {
            return list;
        }
    }

    /**
     * Returns a shallow copy of this GeometrySet.
     */
    copy(): GeometrySet<T> {
        return new GeometrySet<T>(this.toList());
    }

    /**
     * Returns the number of elements stored in this GeometrySet.
     */
    length(): number {
        return this.size;
    }
}