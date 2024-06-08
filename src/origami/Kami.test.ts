import Crease from "./Crease";
import Fraction from "./Fraction";
import Kami from "./Kami";
import Vertex from "./Vertex";

test("toString() correctly works for waterbomb base", () => {
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

    const vertexes: Vertex[] = [
        /* 0: (0, 0) */ new Vertex(new Fraction(0), new Fraction(0)),
        /* 1: (0, 1) */ new Vertex(new Fraction(0), new Fraction(1)),
        /* 2: (1/2, 0) */ new Vertex(new Fraction(1, 2), new Fraction(0)),
        /* 3: (1/2, 1/2) */ new Vertex(new Fraction(1, 2), new Fraction(1, 2)),
        /* 4: (1/2, 1) */ new Vertex(new Fraction(1, 2), new Fraction(1)),
        /* 5: (1, 0) */ new Vertex(new Fraction(1), new Fraction(0)),
        /* 6: (1, 1) */ new Vertex(new Fraction(1), new Fraction(1))
    ];

    const creases: Crease[] = [
        /* 0 to 3 */ new Crease(vertexes[0], vertexes[3], "M"),
        /* 1 to 3 */ new Crease(vertexes[1], vertexes[3], "M"),
        /* 2 to 3 */ new Crease(vertexes[2], vertexes[3], "V"),
        /* 3 to 4 */ new Crease(vertexes[3], vertexes[4], "V"),
        /* 5 to 3 */ new Crease(vertexes[5], vertexes[3], "M"),
        /* 6 to 3 */ new Crease(vertexes[6], vertexes[3], "M")
    ];

    const kami = new Kami(vertexes, creases);

    expect(kami.toString()).toBe(
        "M[(0, 0), (1/2, 1/2)], M[(0, 1), (1/2, 1/2)], V[(1/2, 0), (1/2, 1/2)], " + 
        "V[(1/2, 1/2), (1/2, 1)], M[(1/2, 1/2), (1, 0)], M[(1/2, 1/2), (1, 1)]"
    );
});