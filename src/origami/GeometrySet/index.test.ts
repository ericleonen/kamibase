import GeometrySet from ".";
import Crease from "../Crease";
import Vertex from "../Vertex";
import { CREASES, VERTEXES } from "../common";

test("constructor() instantiates a GeometrySet from a list of Vertexes", () => {
    const vertexes = Object.values(VERTEXES);
    const vertexesTwice = vertexes.concat(vertexes);
    const set = new GeometrySet<Vertex>(vertexesTwice);

    expect(set.length()).toBe(vertexes.length);
    expect(set.contains(...vertexes)).toBeTruthy();
});

test("contains() confirms a GeometrySet contains a Crease", () => {
    const creases = [CREASES["major mountain"], CREASES["minor valley"]];
    const set = new GeometrySet<Crease>(creases);

    expect(set.contains(...creases)).toBeTruthy();
    expect(set.contains(new Crease("N", VERTEXES["top left"], VERTEXES["bottom right"])))
        .toBeFalsy();
});

test("add() adds a Vertex to a GeometrySet", () => {
    const set = new GeometrySet<Vertex>();

    expect(set.length()).toBe(0);

    set.add(VERTEXES["center"], VERTEXES["bottom right"]);

    expect(set.length()).toBe(2);
});

test("remove() removes a Vertex from a GeometrySet", () => {
    const set = new GeometrySet<Vertex>([VERTEXES["center"]]);
    set.remove(VERTEXES["center"]);

    expect(set.length()).toBe(0);
});

test("get() adds a new Vertex to a GeometrySet and returns it", () => {
    const set = new GeometrySet<Vertex>();
    set.get(VERTEXES["center"]);

    expect(set.contains(VERTEXES["center"])).toBeTruthy();
});

test("toList() returns a sorted list of Creases", () => {
    const unsorted = [CREASES["minor mountain"], CREASES["major valley"]];
    const set = new GeometrySet<Crease>(unsorted);

    const sorted = set.toList(true);

    expect(
        sorted[0].equals(CREASES["major valley"]) 
        && sorted[1].equals(CREASES["minor mountain"])
    ).toBeTruthy();
});

test("length() returns the number of elements in a GeometrySet", () => {
    const set = new GeometrySet<Vertex>();

    expect(set.length()).toBe(0);

    set.add(VERTEXES["top left"]);

    expect(set.length()).toBe(1);
});

test("isEmpty() confirms if a GeometrySet is empty", () => {
    const set = new GeometrySet<Vertex>();

    expect(set.isEmpty()).toBeTruthy();

    set.add(VERTEXES["top left"]);
    
    expect(set.isEmpty()).toBeFalsy();
});

test("copy() returns a copy of a GeometrySet", () => {
    const vertexes = Object.values(VERTEXES)

    const orig = new GeometrySet<Vertex>(vertexes);
    const copy = orig.copy();

    expect(copy.length()).toBe(vertexes.length);
    expect(orig === copy).toBeFalsy();
});