import fs from 'node:fs';
import Kami from '.';
import Vertex from '../Vertex';
import Crease from '../Crease';
import { CREASES, VERTEXES } from '../common';

test("constructor() initializes a new Kami", () => {
    const topLeft = VERTEXES["top left"].copy();
    const bottomRight = VERTEXES["bottom right"].copy();
    const crease = new Crease("M", topLeft, bottomRight);

    const kami = new Kami([topLeft, bottomRight], [crease]);

    // check all vertexes are present
    expect(kami.vertexes.length()).toBe(4);
    expect(kami.vertexes.contains(topLeft, bottomRight)).toBe(true);
    // check all creases are present
    expect(kami.creases.length()).toBe(5);
    expect(kami.creases.contains(crease)).toBe(true);
});

test("Kami.fromString() reads waterbomb.kami", () => {
    let kamiString = "";

    try {
        kamiString = fs.readFileSync("public/waterbomb.kami", "utf8");
    } catch (err) {
        console.error(err);
        fail();
    }

    const kami = Kami.fromString(kamiString);

    // check vertexes
    expect(kami.vertexes.length()).toBe(7);
    expect(kami.vertexes.contains(
        VERTEXES["top left"],
        VERTEXES["top right"],
        new Vertex(0, 0.5),
        VERTEXES["center"],
        new Vertex(1, 0.5),
        VERTEXES["bottom left"],
        VERTEXES["bottom right"]
    )).toBeTruthy();
    expect(kami.creases.length()).toBe(10);
    // check creases
    expect(kami.creases.contains(
        Crease.fromString("M 0 0 0.5 0.5"),
        Crease.fromString("M 0.5 0.5 1 1"),
        Crease.fromString("M 0.5 0.5 1 0"),
        Crease.fromString("M 0 1 0.5 0.5"),
        Crease.fromString("V 0 0.5 0.5 0.5"),
        Crease.fromString("V 0.5 0.5 1 0.5")
    )).toBeTruthy();
});

test("Kami.creaseGrid() initializes a Kami with a pre-creased grid", () => {
    const kami = Kami.creaseGrid(4);

    const expectedCreases = [];

    for (let x = 0; x < 1; x += 0.25) {
        for (let y = 0.25; y < 1; y += 0.25) {
            expectedCreases.push(Crease.fromString(`N ${x} ${y} ${x + 0.25} ${y}`));
        }
    }

    for (let y = 0; y < 1; y += 0.25) {
        for (let x = 0.25; x < 1; x += 0.25) {
            expectedCreases.push(Crease.fromString(`N ${x} ${y} ${x} ${y + 0.25}`));
        }
    }

    expect(kami.creases.contains(...expectedCreases)).toBeTruthy();
    expect(kami.creases.length()).toBe(expectedCreases.length + 4);
});

test("toString() returns the Kami as a string, compressed if specified", () => {
    const kamiStr = "M 0 0 0.5 0.5\nM 0.5 0.5 1 1";
    const kami = Kami.fromString(kamiStr);

    // uncompressed
    expect(kami.toString()).toBe(kamiStr);
    // compressed
    expect(kami.toString(true)).toBe("M 0 0 1 1");
});

test("toRenderable() returns a list of Kami creases ready for rendering", () => {
    const kami = Kami.creaseGrid(2);
    kami.crease("M", 0, 0, 0.5, 0.5);
    kami.crease("V", 0.5, 0.5, 1, 1);

    const hoveredCrease = Crease.fromString("V 0.5 0.5 1 1");

    const creasePriority = (crease: Crease): number => {
        if (crease.equals(hoveredCrease)) return 3;

        if (["M", "V"].includes(crease.type)) return 1;
        else if (crease.type === "N") return 2;
        else return 4;
    };

    const creases = kami.toRenderable(hoveredCrease);

    for (let i = 0; i < kami.creases.length() - 1; i++) {
        const diff = creasePriority(creases[i + 1]) - creasePriority(creases[i]);

        expect(diff).toBeGreaterThanOrEqual(0);
    }
});

test("crease() handles intersecting creases", () => {
    const kami = new Kami();
    const process1 = kami.crease("M", 0, 0, 1, 1);
    const process2 = kami.crease("V", 1, 0, 0, 1);

    // kami was creased correctly
    expect(kami.vertexes.contains(VERTEXES["center"])).toBeTruthy();
    expect(kami.vertexes.get(VERTEXES["center"]).creases.length()).toBe(4);
    // correct processes returned
    expect(process1).toEqual([Crease.fromString("M 0 0 1 1").toAction("crease")]);
    expect(process2).toEqual([
        Crease.fromString("V 0 1 0.5 0.5").toAction("crease"),
        Crease.fromString("V 0.5 0.5 1 0").toAction("crease")
    ]);
});

test("crease() handles vertex and line intersection", () => {
    const kami = new Kami();
    const process1 = kami.crease("M", 0, 0, 0.5, 0.5);
    const process2 = kami.crease("V", 0, 1, 1, 0);

    // kami was creased correctly
    expect(kami.creases.length()).toBe(7);
    expect(kami.vertexes.get(VERTEXES["center"]).creases.length()).toBe(3);
    expect(kami.vertexes.get(VERTEXES["top left"]).creases.length()).toBe(3);
    // correct processes returned
    expect(process1).toEqual([Crease.fromString("M 0 0 0.5 0.5").toAction("crease")]);
    expect(process2).toEqual([
        Crease.fromString("V 0 1 0.5 0.5").toAction("crease"),
        Crease.fromString("V 0.5 0.5 1 0").toAction("crease")
    ]);
});

test("crease() handles old crease containing new crease", () => {
    const kami = new Kami();
    const process1 = kami.crease("M", 0, 0, 1, 1);
    const process2 = kami.crease("V", 0.25, 0.25, 0.75, 0.75);

    const leftCrease = Crease.fromString("M 0 0 0.25 0.25");
    const middleCrease = Crease.fromString("V 0.25 0.25 0.75 0.75");
    const rightCrease = Crease.fromString("M 0.75 0.75 1 1");

    // kami was creased correctly
    expect(kami.creases.length()).toBe(7);
    expect(kami.creases.contains(leftCrease, middleCrease, rightCrease)).toBeTruthy();
    // correct processes returned
    expect(process1).toEqual([CREASES["major mountain"].toAction("crease")]);
    expect(process2).toEqual([
        CREASES["major mountain"].toAction("erase"),
        leftCrease.toAction("crease"),
        middleCrease.toAction("crease"),
        rightCrease.toAction("crease")
    ]);
});

test("crease() handles new crease containing an old crease", () => {
    const kami = new Kami();
    const process1 = kami.crease("V", 0.25, 0.25, 0.75, 0.75);
    const process2 = kami.crease("M", 0, 0, 1, 1);

    const leftCrease = Crease.fromString("M 0 0 0.25 0.25");
    const middleCrease = Crease.fromString("M 0.25 0.25 0.75 0.75");
    const rightCrease = Crease.fromString("M 0.75 0.75 1 1");

    // kami was creased correctly
    expect(kami.creases.length()).toBe(7);
    expect(kami.creases.contains(leftCrease, middleCrease, rightCrease)).toBeTruthy();
    // correct processes returned
    expect(process1).toEqual([Crease.fromString("V 0.25 0.25 0.75 0.75").toAction("crease")]);
    expect(process2).toEqual([
        Crease.fromString("V 0.25 0.25 0.75 0.75").toAction("erase"),
        leftCrease.toAction("crease"),
        middleCrease.toAction("crease"),
        rightCrease.toAction("crease")
    ]);
});