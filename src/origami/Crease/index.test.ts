import Crease from ".";
import Fraction from "../Fraction";
import Vertex from "../Vertex";

test('Crease.fromString() correctly reads "V[(1, 1), (1/2, 1/2)]"', () => {
    const crease1 = Crease.fromString("V[(1, 1), (1/2, 1/2)]");
    const crease2 = new Crease(
        new Vertex(new Fraction(1), new Fraction(1)),
        new Vertex(new Fraction(1, 2), new Fraction(1, 2)),
        "V"
    );

    expect(crease1.equals(crease2)).toBe(true);
});