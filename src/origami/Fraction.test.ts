import Fraction from "./Fraction";

test('Fraction.fromString("5/63") correctly reads the fraction string', () => {
    const frac = Fraction.fromString("5/63");

    expect([frac.n, frac.d]).toEqual([5, 63]);
});

test('simplify() turns 6/4 to 3/2', () => {
    const frac = new Fraction(6, 4);
    frac.simplify();

    expect([frac.n, frac.d]).toEqual([3, 2]);
});