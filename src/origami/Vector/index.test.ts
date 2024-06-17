import Vector from ".";
import { VERTEXES } from "../common";

test("Vector.fromVertexes() calculates a Vector from a head and a tail Vertex", () => {
    const tail = VERTEXES["center"];
    const head = VERTEXES["top right"];
    const vector = Vector.fromVertexes(tail, head);

    expect(vector.x).toBe(0.5);
    expect(vector.y).toBe(-0.5);
});

test("add() and subtract() add and subtract Vectors", () => {
    let  vector = new Vector(0, 0);
    vector = vector.add(new Vector(0.5, 0));

    expect(vector.x).toBe(0.5);
    expect(vector.y).toBe(0);

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

    expect(parallel1.isParallelTo(parallel2)).toBeTruthy();
});

test("compareTo() compares two Vectors", () => {
    const smaller = new Vector(0, 0.5);
    const larger = new Vector(0, 1);

    expect(smaller.compareTo(larger)).toBeLessThan(0);
    expect(larger.compareTo(smaller)).toBeGreaterThan(0);
});

test("equals() confirms two Vectors are equal", () => {
    const equal1 = new Vector(1, 1);
    const equal2 = new Vector(1, 1);

    expect(equal1.equals(equal2)).toBeTruthy();
});

test("dot() takes the dot product of two Vectors", () => {
    const vector1 = new Vector(-1, 1);
    const vector2 = new Vector(0.5, 2);

    expect(vector1.dot(vector2)).toBe(1.5);
});