import Vector from "../Vector";
import { VERTEXES } from "../common";

test("translate() translates a Vertex by a Vector", () => {
    const delta = new Vector(0.5, 0.5);
    const translated = VERTEXES["top left"].translate(delta);

    expect(translated.equals(VERTEXES["center"])).toBeTruthy();
});

test("key() returns a Vertex's key", () => {
    expect(VERTEXES["bottom right"].key()).toBe("1 1");
});
