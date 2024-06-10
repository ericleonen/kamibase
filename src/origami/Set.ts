import Crease from "./Crease";
import Vertex from "./Vertex";

export default class Set<T extends Vertex | Crease> {
    private map: {[key: string]: T};

    constructor(arr: T[] = []) {
        this.map = {};

        for (let item of arr) {
            const key = item.toString();

            if (!(key in this.map)) {
                this.map[key] = item;
            }
        }
    }

    public add(item: T) {
        if (!this.contains(item)) {
            this.map[item.toString()] = item;
        }
    }

    public contains(item: T): boolean {
        return item.toString() in this.map;
    }

    public toList(): T[] {
        return Object.values(this.map);
    }

    public get(item: T): T {
        const key = item.toString();

        if (key in this.map) {
            return this.map[key];
        } else {
            this.add(item);

            return item;
        }
    }
}