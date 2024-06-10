import Crease from "../Crease";
import Fraction from "../Fraction";
import Kami from ".";
import Vertex from "../Vertex";
import fs from "node:fs";

/*
    WATERBOMB BASE
    0===========1
    | \       / |
    |   \   /   |   
    2-----3-----4       
    |   /   \   |  
    | /       \ | 
    5===========6
*/

const waterbombVertexes: Vertex[] = [
    /* 0: (0, 0) */ new Vertex(new Fraction(0), new Fraction(0)),
    /* 1: (0, 1) */ new Vertex(new Fraction(0), new Fraction(1)),
    /* 2: (1/2, 0) */ new Vertex(new Fraction(1, 2), new Fraction(0)),
    /* 3: (1/2, 1/2) */ new Vertex(new Fraction(1, 2), new Fraction(1, 2)),
    /* 4: (1/2, 1) */ new Vertex(new Fraction(1, 2), new Fraction(1)),
    /* 5: (1, 0) */ new Vertex(new Fraction(1), new Fraction(0)),
    /* 6: (1, 1) */ new Vertex(new Fraction(1), new Fraction(1))
];

const waterbombCreases: Crease[] = [
    /* 0 to 3 */ new Crease(waterbombVertexes[0], waterbombVertexes[3], "M"),
    /* 1 to 3 */ new Crease(waterbombVertexes[1], waterbombVertexes[3], "M"),
    /* 2 to 3 */ new Crease(waterbombVertexes[2], waterbombVertexes[3], "V"),
    /* 3 to 4 */ new Crease(waterbombVertexes[3], waterbombVertexes[4], "V"),
    /* 5 to 3 */ new Crease(waterbombVertexes[5], waterbombVertexes[3], "M"),
    /* 6 to 3 */ new Crease(waterbombVertexes[6], waterbombVertexes[3], "M")
];

const waterbombKamiString = "M[(0, 0), (1/2, 1/2)], M[(0, 1), (1/2, 1/2)], " + 
    "V[(1/2, 0), (1/2, 1/2)], V[(1/2, 1/2), (1/2, 1)], M[(1/2, 1/2), (1, 0)], " +
    "M[(1/2, 1/2), (1, 1)]"    

const waterbombKami = new Kami(waterbombVertexes, waterbombCreases);

test("toString() correctly works for waterbomb base", () => {
    expect(waterbombKami.toString()).toBe(waterbombKamiString);
});

test("Kami.fromString() correctly works for waterbomb base", () => {
    try {
        expect(Kami.fromString(
            fs.readFileSync("public/waterbomb.kami", "utf8")
        ).toString()).toBe(waterbombKamiString);
    } catch (err) {
        console.error(err);
    }
})