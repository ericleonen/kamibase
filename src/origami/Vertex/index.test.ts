import Vertex from ".";
import Fraction from "../Fraction";

test("compareTo() correctly evaluates (1, 0) < (1, 1)", () => {
    const smallerVertex = new Vertex(new Fraction(1), new Fraction(0));
    const largerVertex = new Vertex(new Fraction(1), new Fraction(1));

    expect(smallerVertex.compareTo(largerVertex)).toBeLessThan(0);
});

test("equals() correctly evaluates (1/2, 1/2) = (1/2, 1/2)", () => {
    const vertex1 = new Vertex(new Fraction(1, 2), new Fraction(1, 2));
    const vertex2 = new Vertex(new Fraction(1, 2), new Fraction(1, 2));

    expect(vertex1.equals(vertex2)).toBe(true);
});

test('Vertex.fromString() correctly reads "(1/2, 0)"', () => {
    const vertex = new Vertex(new Fraction(1, 2), new Fraction(0));

    expect(Vertex.fromString("(1/2, 0)").equals(vertex)).toBe(true);
});
