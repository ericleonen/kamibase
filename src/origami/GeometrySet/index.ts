import { listKey } from "@/utils/string";
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
     * Returns true if this GeometrySet has all specified items, false otherwise.
     */
    public contains(...items: T[]): boolean {
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
     */
    public add(...items: T[]) {
        items.forEach(item => {
            if (!this.contains(item)) {
                this.map[item.key()] = item; 
                this.size += 1;
            }
        });
    }

    /**
     * Removes item from the GeometrySet. If the item is not in the GeometrySet, does nothing.
     */
    public remove(item: T) {
        if (this.contains(item)) {
            delete this.map[item.key()];
            this.size -= 1;
        }
    }

    /**
     * Retrieves the equivalent item from the GeometrySet. If the item is not in the GeometrySet,
     * adds the item and returns it.
     */
    public get(item: T): T {
        if (this.contains(item)) {
            return this.map[item.key()];
        } else {
            this.add(item);
            return item;
        }
    }

    /**
     * Retrieves the item in the GeometrySet defined by the given geometry position. If no item has
     * that geometry position, returns undefined.
     */
    public getGeometrically(...n: number[]): T | undefined {
        const key = listKey(...n);

        if (key in this.map) {
            return this.map[key];
        }
    }

    /**
     * Returns an optionally sorted loopable array of this GeometrySet's items.
     */
    public toList(sorted: boolean = false): T[] {
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
     * Returns the number of elements stored in this GeometrySet.
     */
    public length(): number {
        return this.size;
    }

    /**
     * Returns whether or not this GeometrySet is empty.
     */
    public isEmpty(): boolean {
        return this.size === 0;
    }

    /**
     * Returns a copy of this GeometrySet.
     */
    public copy(): GeometrySet<T> {
        return new GeometrySet<T>(this.toList());
    }

    /**
     * Clears all items in this GeometrySet.
     */
    public clear() {
        this.map = {};
        this.size = 0;
    }
}