import Vector from ".";
import { VERTEXES } from "../common";

test("constructor() initializes a Vector", () => {
    const vector = new Vector(0.25, 0.5);

    // check x component
    expect(vector.x).toBe(0.25);
    // check y component
    expect(vector.y).toBe(0.5);
});

test("Vector.fromVertexes() calculates a Vector from a head and a tail Vertex", () => {
    const tail = VERTEXES["center"];
    const head = VERTEXES["top right"];
    const vector = Vector.fromVertexes(tail, head);

    // check x component
    expect(vector.x).toBe(0.5);
    // check y component
    expect(vector.y).toBe(-0.5);
});

test("add() and subtract() add and subtract Vectors", () => {
    let vector = new Vector(0, 0);

    // sum two vectors
    vector = vector.add(new Vector(0.5, 0));
    expect(vector.x).toBe(0.5);
    expect(vector.y).toBe(0);
    // subtract two vectors
    vector = vector.subtract(new Vector(1, 0.5));
    expect(vector.x).toBe(-0.5);
    expect(vector.y).toBe(-0.5);
});

test("scale() multiplies a Vector by a constant", () => {
    let vector = new Vector(0.5, -0.5);

    vector = vector.scale(2);
    expect(vector.x).toBe(1);
    expect(vector.y).toBe(-1);
});

test("isParallelTo() confirms two Vectors are parallel", () => {
    const parallel1 = new Vector(1, 1.5);
    const parallel2 = new Vector(0.5, 0.75);
    const notParallel = new Vector(-1, 1);

    // vectors that are parallel
    expect(parallel1.isParallelTo(parallel2)).toBeTruthy();
    // vectors that are not parallel
    expect(parallel1.isParallelTo(notParallel)).toBeFalsy();
});

test("compareTo() compares two Vectors", () => {
    const smaller = new Vector(0, 0.5);
    const larger = new Vector(0, 1);

    // smaller is less than larger
    expect(smaller.compareTo(larger)).toBeLessThan(0);
    // larger is bigger than smaller
    expect(larger.compareTo(smaller)).toBeGreaterThan(0);
});

test("equals() confirms two Vectors are equal", () => {
    const equal1 = new Vector(1, 1);
    const equal2 = new Vector(1, 1);
    const notEqual = new Vector(0.5, 0.5);

    // vectors that are equal
    expect(equal1.equals(equal2)).toBeTruthy();
    // vectors that are not equal
    expect(equal1.equals(notEqual)).toBeFalsy();
});

test("dot() takes the dot product of two Vectors", () => {
    const vector1 = new Vector(-1, 1);
    const vector2 = new Vector(0.5, 2);

    expect(vector1.dot(vector2)).toBe(1.5);
});