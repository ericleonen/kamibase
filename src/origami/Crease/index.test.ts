import Vector from "../Vector";
import { VERTEXES, CREASES } from "../common";
import Crease from ".";
import Vertex from "../Vertex";

test("constructor() instantiates a new Crease", () => {
    const crease = CREASES["major mountain"];

    expect(crease.type).toEqual("M");
    expect(
        crease.vertex1.equals(VERTEXES["top left"]) 
        && crease.vertex2.equals(VERTEXES["bottom right"])
    ).toBeTruthy();
    expect(crease.length).toBeCloseTo(Math.SQRT2);
    expect(crease.vector.equals(new Vector(1, 1))).toBeTruthy();
});

test("compareTo() compares Creases", () => {
    const smaller = CREASES["major mountain"];
    const larger = CREASES["minor valley"];

    expect(smaller.compareTo(larger)).toBeLessThan(0);
    expect(larger.compareTo(smaller)).toBeGreaterThan(0);
});

test("equals() confirms two Creases are equal", () => {
    expect(CREASES["major mountain"].equals(CREASES["major valley"])).toBeTruthy();
});

test("contains() confirms a Vertex is on a Crease", () => {
    expect(CREASES["minor valley"].contains(VERTEXES["center"])).toBeTruthy(); 
});

test("contains() confirms a Crease is in another Crease", () => {
    const innerCrease = new Crease("V", new Vertex(0.25, 0.25), VERTEXES["bottom right"]);

    expect(CREASES["major mountain"].contains(innerCrease)).toBeTruthy();
});

test("overlaps() confirms overlap between Creases", () => {
    const noOverlap1 = new Crease("M", VERTEXES["top left"], VERTEXES["center"]);
    const noOverlap2 = new Crease("V", VERTEXES["center"], VERTEXES["bottom right"]);

    expect(noOverlap1.overlaps(noOverlap2)).toBeFalsy();

    const overlap1 = new Crease("M", VERTEXES["top left"], new Vertex(0.75, 0.75));
    const overlap2 = new Crease("V", new Vertex(0.25, 0.25), VERTEXES["bottom right"]);

    expect(overlap1.overlaps(overlap2)).toBeTruthy();
});

test("isParallelTo() confirms Creases are parallel", () => {
    const notParallel1 = CREASES["major mountain"];
    const notParallel2 = CREASES["minor valley"];

    expect(notParallel1.isParallelTo(notParallel2)).toBeFalsy();

    const parallel1 = CREASES["major mountain"];
    const parallel2 = new Crease("V", new Vertex(0.5, 0), new Vertex(1, 0.5));

    expect(parallel1.isParallelTo(parallel2)).toBeTruthy();
});

test("getIntersectionWith() finds the Vertex two Creases intersect", () => {
    const intersection = CREASES["major mountain"].getIntersectionWith(CREASES["minor valley"]);

    expect(intersection && intersection.equals(VERTEXES["center"])).toBeTruthy();
});

test("split() splits a Crease by the Vertex", () => {
    const [unsplit] = CREASES["minor valley"].split(VERTEXES["top right"]);

    expect(unsplit.equals(CREASES["minor valley"]));

    const [split1, split2] = CREASES["minor valley"].split(VERTEXES["center"]);
    const expectedSplit1 = new Crease("V", VERTEXES["bottom left"], VERTEXES["center"]);
    const expectedSplit2 = new Crease("V", VERTEXES["center"], VERTEXES["top right"]);

    expect(split1.equals(expectedSplit1) && split2.equals(expectedSplit2)).toBeTruthy();
});

test("key() returns a Crease's key", () => {
    expect(CREASES["minor mountain"].key()).toBe("0 1 1 0");
});

test("toString() returns a String representing this Crease", () => {
    expect(CREASES["major mountain"].toString()).toBe("M 0 0 1 1");
});