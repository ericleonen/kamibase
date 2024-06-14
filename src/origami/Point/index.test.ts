import Vector from "../Vector";
import Vertex from "../Vertex";
import { VERTEXES } from "../common";

test("compareTo() compares Points", () => {
    const smaller = VERTEXES["top left"];
    const larger = VERTEXES["bottom right"];

    expect(smaller.compareTo(larger)).toBeLessThan(0);
    expect(larger.compareTo(smaller)).toBeGreaterThan(0);
});

test("equals() confirms two Points are equal", () => {
    const equivalent1 = VERTEXES["center"];
    const equivalent2 = new Vertex(0.5, 0.5);
    
    expect(equivalent1.equals(equivalent2)).toBeTruthy();
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