import Crease from "../Crease";
import Vector from "../Vector";
import Vertex from "../Vertex";
import { CREASES, VERTEXES } from "../common";

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

test("distance() calculates the distance of a Point and a Crease", () => {
    expect(VERTEXES["top right"].distance(CREASES["major mountain"])).toBeCloseTo(Math.SQRT2 / 2);
    expect(VERTEXES["bottom right"].distance(
        new Crease("M", new Vertex(0.25, 0.25), VERTEXES["center"])
    )).toBe(Infinity);
})