import fs from 'node:fs';
import Kami from '.';
import Vertex from '../Vertex';
import Crease from '../Crease';
import { VERTEXES } from '../common';

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
    expect(kami.creases.length()).toBe(12);
});

test("crease() handles intersecting creases", () => {
    const kami = new Kami();
    kami.crease("M", 0, 0, 1, 1);
    kami.crease("V", 1, 0, 0, 1);

    expect(kami.vertexes.contains(VERTEXES["center"])).toBeTruthy();
    expect(kami.vertexes.get(VERTEXES["center"]).creases.length()).toBe(4);
});

test("crease() handles vertex and line intersection", () => {
    const kami = new Kami();
    kami.crease("M", 0, 0, 0.5, 0.5);
    kami.crease("V", 0, 1, 1, 0);

    expect(kami.creases.length()).toBe(7);
    expect(kami.vertexes.get(VERTEXES["center"]).creases.length()).toBe(3);
    expect(kami.vertexes.get(VERTEXES["top left"]).creases.length()).toBe(3);
});

test("crease() handles old crease containing new crease", () => {
    const kami = new Kami();
    kami.crease("V", 0, 0, 1, 0);
    kami.crease("M", 0, 0, 0.5, 0);

    const topCenter = new Vertex(0.5, 0);

    const expectedCrease1 = new Crease("M", VERTEXES["top left"], topCenter);
    const expectedCrease2 = new Crease("V", topCenter, VERTEXES["top right"]);

    expect(kami.creases.length()).toBe(5);
    expect(kami.creases.contains(expectedCrease1, expectedCrease2)).toBeTruthy();
    expect(kami.vertexes.get(topCenter).creases.length()).toBe(2);
});

test("crease() handles new crease containing an old crease", () => {
    const kami = new Kami();
    kami.crease("M", 0, 0, 0.5, 0);
    kami.crease("V", 0, 0, 1, 0);

    const topCenter = new Vertex(0.5, 0);

    const expectedCrease1 = new Crease("V", VERTEXES["top left"], topCenter);
    const expectedCrease2 = new Crease("V", topCenter, VERTEXES["top right"]);

    expect(kami.creases.length()).toBe(5);
    expect(kami.creases.contains(expectedCrease1, expectedCrease2)).toBeTruthy();
    expect(kami.vertexes.get(topCenter).creases.length()).toBe(2);
});

test("crease() handles new crease overlapping old crease", () => {
    const kami = new Kami();
    kami.crease("M", 0, 0, 0.5, 0.5);
    kami.crease("V", 0.25, 0.25, 0.75, 0.75);

    const vertex1 = VERTEXES["top left"];
    const vertex2 = new Vertex(0.25, 0.25);
    const vertex3 = VERTEXES["center"];
    const vertex4 = new Vertex(0.75, 0.75);

    const expectedCrease1 = new Crease("M", vertex1, vertex2);
    const expectedCrease2 = new Crease("V", vertex2, vertex3);
    let expectedCrease3 = new Crease("V", vertex3, vertex4);

    expect(kami.creases.length()).toBe(7);
    expect(kami.creases.contains(
        expectedCrease1,
        expectedCrease2,
        expectedCrease3
    )).toBeTruthy();

    kami.crease("M", 0.5, 0.5, 1, 1);

    const vertex5 = VERTEXES["bottom right"];

    expectedCrease3 = new Crease("M", vertex3, vertex4);
    const expectedCrease4 = new Crease("M", vertex4, vertex5);

    expect(kami.creases.contains(
        expectedCrease3,
        expectedCrease4
    )).toBeTruthy();
});