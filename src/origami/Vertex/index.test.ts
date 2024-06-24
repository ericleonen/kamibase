import Vertex from ".";
import Vector from "../Vector";
import { VERTEXES } from "../common";

test("contructor() initializes a Vertex", () => {
    const vertex = new Vertex(0.5, 0.75);

    // x value
    expect(vertex.x).toBe(0.5);
    // y value
    expect(vertex.y).toBe(0.75);
});

test("translate() translates a Vertex by a Vector", () => {
    const delta = new Vector(0.5, 0.5);
    const translated = VERTEXES["top left"].translate(delta);

    expect(translated.equals(VERTEXES["center"])).toBeTruthy();
});

test("key() returns a Vertex's key", () => {
    expect(VERTEXES["bottom right"].key()).toBe("1 1");
});

test("copy() returns a copy of a Vertex", () => {
    const orig = VERTEXES["center"];
    const copy = orig.copy();

    expect(orig === copy).toBeFalsy();
    expect(orig.equals(copy)).toBeTruthy();
});

test("onSameBorder() confirms whether or Vertexes are on the same border", () => {
    const onBorder1 = VERTEXES["top left"];
    const onBorder2 = VERTEXES["top right"];
    const notOnBorder1 = VERTEXES["bottom right"];
    const notOnBorder2 = VERTEXES["center"];

    // vertexes on the same border
    expect(onBorder1.onSameBorder(onBorder2)).toBeTruthy();
    // vertexes both on borders, but not the same border
    expect(onBorder1.onSameBorder(notOnBorder1)).toBeFalsy();
    // vertex not on any border
    expect(onBorder1.onSameBorder(notOnBorder2)).toBeFalsy();
});