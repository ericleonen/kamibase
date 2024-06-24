import GeometrySet from ".";
import Crease from "../Crease";
import Vertex from "../Vertex";
import { CREASES, VERTEXES } from "../common";

const vertexesList = Object.values(VERTEXES);
const creasesList = [CREASES["major mountain"], CREASES["minor valley"]];

test("constructor() instantiates a GeometrySet and length() returns its length", () => {
    const vertexes = vertexesList;
    const vertexesTwice = vertexes.concat(vertexes);
    const vertexesSet = new GeometrySet<Vertex>(vertexesTwice);

    const creases = creasesList;
    const creasesTwice = creases.concat(creases);
    const creasesSet = new GeometrySet<Crease>(creasesTwice);

    // vertexes
    expect(vertexesSet.length()).toBe(vertexes.length);
    expect(vertexesSet.contains(...vertexes)).toBeTruthy();
    // creases
    expect(creasesSet.length()).toBe(creases.length);
    expect(creasesSet.contains(...creases)).toBeTruthy();
});

test("contains() confirms whether or not a GeometrySet has items", () => {
    const vertexesSet = new GeometrySet<Vertex>(vertexesList);
    const creasesSet = new GeometrySet<Crease>(creasesList);

    // vertexes in vertex set
    expect(vertexesSet.contains(...vertexesList)).toBeTruthy();
    // vertex not in vertex set
    expect(vertexesSet.contains(new Vertex(0.25, 0.25))).toBeFalsy();
    // creases
    expect(creasesSet.contains(...creasesList)).toBeTruthy();
    // creases not in crease set
    expect(creasesSet.contains(CREASES["minor mountain"], CREASES["major valley"])).toBeFalsy();
});

test("add() adds items to a GeometrySet", () => {
    const vertexesSet = new GeometrySet<Vertex>();
    vertexesSet.add(VERTEXES["center"], VERTEXES["bottom right"]);
    const creasesSet = new GeometrySet<Crease>();
    creasesSet.add(CREASES["minor mountain"], CREASES["major valley"]);

    // vertexes
    expect(vertexesSet.length()).toBe(2);
    // creases
    expect(creasesSet.length()).toBe(2);
});

test("remove() removes an item from a GeometrySet", () => {
    const vertexesSet = new GeometrySet<Vertex>([VERTEXES["center"]]);
    const creasesSet = new GeometrySet<Crease>([CREASES["major mountain"]]);

    // vertex not in set
    vertexesSet.remove(VERTEXES["top left"]);
    expect(vertexesSet.length()).toBe(1);
    // vertex in set
    vertexesSet.remove(VERTEXES["center"]);
    expect(vertexesSet.length()).toBe(0);
    // crease not in set
    creasesSet.remove(CREASES["minor mountain"]);
    expect(creasesSet.length()).toBe(1);
    // crease in set
    creasesSet.remove(CREASES["major mountain"]);
    expect(creasesSet.length()).toBe(0);
});

test("get() retrieves an item from a GeometrySet, adding to it if needed", () => {
    const vertexesSet = new GeometrySet<Vertex>([VERTEXES["center"]]);
    const creasesSet = new GeometrySet<Crease>([CREASES["major mountain"]]);

    // vertex in set
    expect(vertexesSet.get(VERTEXES["center"]).equals(VERTEXES["center"])).toBeTruthy();
    expect(vertexesSet.length()).toBe(1);
    // vert not in set
    expect(vertexesSet.get(VERTEXES["top right"]).equals(VERTEXES["top right"])).toBeTruthy();
    expect(vertexesSet.length()).toBe(2);
    // crease in set
    expect(creasesSet.get(CREASES["major mountain"])
        .equals(CREASES["major mountain"])).toBeTruthy();
    expect(creasesSet.length()).toBe(1);
    // crease not in set
    expect(creasesSet.get(CREASES["minor mountain"])
        .equals(CREASES["minor mountain"])).toBeTruthy();
    expect(creasesSet.length()).toBe(2);
});

test("getGeometrically() retrieves an item by its geometry, if it's in the GeometrySet", () => {
    const vertexesSet = new GeometrySet<Vertex>([VERTEXES["center"]]);
    const creasesSet = new GeometrySet<Crease>([CREASES["major mountain"]]);

    // vertex in set
    expect(vertexesSet.getGeometrically(0.5, 0.5)).toBeTruthy();
    // vertex not in set
    expect(vertexesSet.getGeometrically(0, 0)).toBeFalsy();
    // crease in set
    expect(creasesSet.getGeometrically(0, 0, 1, 1)).toBeTruthy();
    // crease not in set
    expect(creasesSet.getGeometrically(1, 0, 0, 1)).toBeFalsy();
});

test("toList(true) returns a sorted list of items", () => {
    const unsortedVertexes = [VERTEXES["center"], VERTEXES["top left"]];
    const vertexesSet = new GeometrySet<Vertex>(unsortedVertexes);
    const sortedVertexes = vertexesSet.toList(true);

    const unsortedCreases = [CREASES["minor mountain"], CREASES["major valley"]];
    const creasesSet = new GeometrySet<Crease>(unsortedCreases);
    const sortedCreases = creasesSet.toList(true);

    // vertexes
    expect(
        sortedVertexes[0].equals(VERTEXES["top left"]) 
        && sortedVertexes[1].equals(VERTEXES["center"])
    ).toBeTruthy();
    // creases
    expect(
        sortedCreases[0].equals(CREASES["major valley"]) 
        && sortedCreases[1].equals(CREASES["minor mountain"])
    ).toBeTruthy();
});

test("isEmpty() confirms whether or not a GeometrySet is empty", () => {
    const vertexesSet = new GeometrySet<Vertex>();
    const creasesSet = new GeometrySet<Crease>();

    // vertexes set is empty
    expect(vertexesSet.isEmpty()).toBeTruthy();
    // vertexes set is not empty
    vertexesSet.add(VERTEXES["top left"]);    
    expect(vertexesSet.isEmpty()).toBeFalsy();
    // creases set is empty
    expect(creasesSet.isEmpty()).toBeTruthy();
    // creases set is not empty
    creasesSet.add(CREASES["minor mountain"]);    
    expect(creasesSet.isEmpty()).toBeFalsy();
});

test("copy() returns a copy of a GeometrySet", () => {
    const vertexesSet = new GeometrySet<Vertex>(vertexesList);
    const vertexesSetCopy = vertexesSet.copy();
    const creasesSet = new GeometrySet<Crease>(creasesList);
    const creasesSetCopy = creasesSet.copy();

    // vertexes set has same items as copy, but not the same reference
    expect(vertexesSet.length()).toBe(vertexesSetCopy.length());
    expect(vertexesSet === vertexesSetCopy).toBeFalsy();
    // creases set has the same items as copy, but not the same reference
    expect(creasesSet.length()).toBe(creasesSetCopy.length());
    expect(creasesSet === creasesSetCopy).toBeFalsy();
});

test("clear() clears a GeometrySet of its items", () => {
    const vertexesSet = new GeometrySet<Vertex>(vertexesList);
    const creasesSet = new GeometrySet<Crease>(creasesList);
    
    vertexesSet.clear();
    creasesSet.clear();

    // vertexes set is cleared
    expect(vertexesSet.isEmpty()).toBeTruthy();
    // creases set is cleared
    expect(creasesSet.isEmpty()).toBeTruthy();
});