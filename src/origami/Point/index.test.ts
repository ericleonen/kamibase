import Point from ".";
import Crease from "../Crease";
import Vector from "../Vector";
import Vertex from "../Vertex";
import { CREASES, VERTEXES } from "../common";

test("constructor initializes a Point", () => {
    const point = new Point(0.25, 0.75);
    
    // x-value
    expect(point.x).toBe(0.25);
    // y-value
    expect(point.y).toBe(0.75);
});

test("compareTo() compares Points", () => {
    const smaller = VERTEXES["top left"];
    const larger = VERTEXES["bottom right"];

    // smaller is less than larger
    expect(smaller.compareTo(larger)).toBeLessThan(0);
    // larger is bigger than smaller
    expect(larger.compareTo(smaller)).toBeGreaterThan(0);
});

test("equals() confirms whether or not two Points are equal", () => {
    const equivalent1 = VERTEXES["center"];
    const equivalent2 = new Vertex(0.5, 0.5);
    const notEquivalent = VERTEXES["top right"];
    
    // two Points are equal
    expect(equivalent1.equals(equivalent2)).toBeTruthy();
    // two Points are not equal
    expect(equivalent1.equals(notEquivalent)).toBeFalsy();
});

test("toVector() turns a Point into a Vector", () => {
    const vector = VERTEXES["bottom right"].toVector();
    
    expect(vector.equals(new Vector(1, 1))).toBeTruthy();
});

test("distance() calculates the distance of two Points", () => {
    const point1 = VERTEXES["top left"];
    const point2 = VERTEXES["center"];

    expect(point1.distance(point2)).toBeCloseTo(Math.SQRT2 / 2);
});