import fs from 'node:fs';
import Kami from '.';
import Vertex from '../Vertex';
import Crease from '../Crease';

test("Kami.fromString() reads waterbomb.kami", () => {
    let kamiString = "";

    try {
        kamiString = fs.readFileSync("public/waterbomb.kami", "utf8");
    } catch (err) {
        console.error(err);
        fail();
    }

    const kami = Kami.fromString(kamiString);

    expect(kami.vertexes.length()).toBe(7);
    expect(kami.creases.length()).toBe(6);
});

test("crease() handles intersecting creases", () => {
    const kami = new Kami();
    kami.crease("M", 0, 0, 1, 1);
    kami.crease("V", 1, 0, 0, 1);

    const expectedIntersection = new Vertex(0.5, 0.5);

    expect(kami.vertexes.contains(expectedIntersection)).toBe(true);
});

test("crease() handles vertex and line intersection", () => {
    const kami = new Kami();
    kami.crease("M", 0, 0, 0.5, 0.5);
    kami.crease("V", 0, 1, 1, 0);

    expect(kami.creases.length()).toBe(3);
});

test("crease() handles old crease containing new crease", () => {
    const kami = new Kami();
    kami.crease("V", 0, 0, 1, 0);
    kami.crease("M", 0, 0, 0.5, 0);

    const expectedCrease1 = new Crease("M", new Vertex(0, 0), new Vertex(0.5, 0));
    const expectedCrease2 = new Crease("V", new Vertex(0.5, 0), new Vertex(1, 0));

    expect(kami.creases.length()).toBe(2);
    expect(kami.creases.contains(expectedCrease1, expectedCrease2)).toBe(true);
});

test("crease() handles new crease containing an old crease", () => {
    const kami = new Kami();
    kami.crease("M", 0, 0, 0.5, 0);
    kami.crease("V", 0, 0, 1, 0);

    const expectedCrease1 = new Crease("V", new Vertex(0, 0), new Vertex(0.5, 0));
    const expectedCrease2 = new Crease("V", new Vertex(0.5, 0), new Vertex(1, 0));

    expect(kami.creases.length()).toBe(2);
    expect(kami.creases.contains(expectedCrease1, expectedCrease2)).toBe(true);
});

test("crease() handles new crease overlapping old crease", () => {
    const kami = new Kami();
    kami.crease("M", 0, 0, 0.5, 0.5);
    kami.crease("V", 0.25, 0.25, 0.75, 0.75);

    const vertex1 = new Vertex(0, 0);
    const vertex2 = new Vertex(0.25, 0.25);
    const vertex3 = new Vertex(0.5, 0.5);
    const vertex4 = new Vertex(0.75, 0.75);

    const expectedCrease1 = new Crease("M", vertex1, vertex2);
    const expectedCrease2 = new Crease("V", vertex2, vertex3);
    const expectedCrease3 = new Crease("V", vertex3, vertex4);

    expect(kami.creases.length()).toBe(3);
    expect(kami.creases.contains(
        expectedCrease1,
        expectedCrease2,
        expectedCrease3
    )).toBe(true);

    kami.crease("M", 0.5, 0.5, 1, 1);

    const vertex5 = new Vertex(1, 1);

    expectedCrease3.type = "M";
    const expectedCrease4 = new Crease("M", vertex4, vertex5);

    expect(kami.creases.contains(
        expectedCrease3,
        expectedCrease4
    )).toBe(true);
});