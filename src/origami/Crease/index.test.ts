import Vector from "../Vector";
import { VERTEXES, CREASES } from "../common";
import Crease from ".";
import Vertex from "../Vertex";
import Point from "../Point";

test("constructor() instantiates a new Crease", () => {
    const crease = CREASES["major mountain"];

    // correct crease type
    expect(crease.type).toEqual("M");
    // correct vertices
    expect(
        crease.vertex1.equals(VERTEXES["top left"]) 
        && crease.vertex2.equals(VERTEXES["bottom right"])
    ).toBeTruthy();
    // correct length
    expect(crease.length).toBeCloseTo(Math.SQRT2);
    // correct vector
    expect(crease.vector.equals(new Vector(1, 1))).toBeTruthy();
});

test("compareTo() compares Creases geometrically", () => {
    const smaller = CREASES["major mountain"];
    const larger = CREASES["minor valley"];

    // smaller < larger
    expect(smaller.compareTo(larger)).toBeLessThan(0);
    // larger > smaller
    expect(larger.compareTo(smaller)).toBeGreaterThan(0);
});

test("equals() confirms whether or not two Creases are equal geometrically", () => {
    // two majors are geometrically equal
    expect(CREASES["major mountain"].equals(CREASES["major valley"])).toBeTruthy();
    // a major and a minor are not geometrically equal
    expect(CREASES["major mountain"].equals(CREASES["minor mountain"])).toBeFalsy();
});

test("contains() confirms whether or not a Vertex is on a Crease", () => {
    // a vertex in the middle of a crease
    expect(CREASES["minor valley"].contains(VERTEXES["center"])).toBeTruthy(); 
    // a vertex at the end of a crease
    expect(CREASES["major mountain"].contains(VERTEXES["top left"])).toBeTruthy();
    // a vertex not on a crease
    expect(CREASES["minor mountain"].contains(VERTEXES["top left"])).toBeFalsy();
});

test("contains() confirms whether or not a Crease is in another Crease", () => {
    const outer = CREASES["major mountain"];
    const inner = Crease.fromString("V 0.25 0.25 0.75 0.75");
    const left = Crease.fromString("M 0 0 0.75 0.75");
    const right = Crease.fromString("V 0.25 0.25 1 1");
    
    // crease overlaps but doesn't contain
    expect(left.contains(right) || right.contains(left)).toBeFalsy();
    // crease fully overlaps other crease
    expect(outer.contains(inner)).toBeTruthy();
    // crease fully overlaps other crease but share vertex
    expect(outer.contains(left) && outer.contains(right)).toBeTruthy();
});

test("isParallelTo() confirms whether or not Creases are parallel", () => {
    const notParallel1 = CREASES["major mountain"];
    const notParallel2 = CREASES["minor valley"];
    const parallel1 = CREASES["major mountain"];
    const parallel2 = new Crease("V", new Vertex(0.5, 0), new Vertex(1, 0.5));

    // non-parallel creases aren't parallel
    expect(notParallel1.isParallelTo(notParallel2)).toBeFalsy();
    // parallel creases are parallel
    expect(parallel1.isParallelTo(parallel2)).toBeTruthy();
});

test("getIntersectionWith() finds the Vertex two Creases intersect", () => {
    const intersection = CREASES["major mountain"].getIntersectionWith(CREASES["minor valley"]);
    const nonIntersect1 = Crease.fromString("M 0 0 1 0");
    const nonIntersect2 = Crease.fromString("V 0 1 1 1");

    // creases intersect
    expect(intersection && intersection.equals(VERTEXES["center"])).toBeTruthy();
    // creases don't intersect
    expect(nonIntersect1.getIntersectionWith(nonIntersect2)).toBeFalsy();
});

test("split() splits a Crease by the Vertex", () => {
    const [unsplit] = CREASES["minor valley"].split(VERTEXES["top right"]);
    const [split1, split2] = CREASES["minor valley"].split(VERTEXES["center"]);
    const expectedSplit1 = new Crease("V", VERTEXES["bottom left"], VERTEXES["center"]);
    const expectedSplit2 = new Crease("V", VERTEXES["center"], VERTEXES["top right"]);

    // split point is at an endpoint
    expect(unsplit.equals(CREASES["minor valley"]));
    // split point is in the crease
    expect(split1.equals(expectedSplit1) && split2.equals(expectedSplit2)).toBeTruthy();
});

test("key() returns a Crease's key", () => {
    expect(CREASES["minor mountain"].key()).toBe("0 1 1 0");
});

test("toString() returns a String representing this Crease", () => {
    expect(CREASES["major mountain"].toString()).toBe("M 0 0 1 1");
});

test("toAction returns a Crease's action", () => {
    const crease = CREASES["major mountain"];
    const creaseAction = crease.toAction("crease");
    const eraseAction = crease.toAction("erase");
    const { type, vertex1, vertex2 } = crease;

    // crease action
    expect(creaseAction).toMatchObject({
        name: "crease",
        params: {
            type,
            x1: vertex1.x,
            y1: vertex1.y,
            x2: vertex2.x,
            y2: vertex2.y
        }
    });
    // erase action
    expect(eraseAction).toMatchObject({
        name: "erase",
        params: {
            type,
            x1: vertex1.x,
            y1: vertex1.y,
            x2: vertex2.x,
            y2: vertex2.y
        }
    });
});

test("distanceToPoint() returns a Creases's distance to a Point", () => {
    const inside = new Point(1, 1);
    const outside = new Point(1, 0.5);
    const crease = Crease.fromString("V 0.25 0.75 0.75 0.25");

    // point is "inside" crease
    expect(crease.distanceToPoint(inside)).toBeCloseTo(Math.SQRT2 / 2);
    // point is "outside" crease
    expect(crease.distanceToPoint(outside)).toBe(Infinity);
});