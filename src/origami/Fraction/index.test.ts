import Fraction from ".";

test('Fraction.fromString() correctly reads "5/63"', () => {
    const frac = Fraction.fromString("5/63");

    expect([frac.n, frac.d]).toEqual([5, 63]);
});

test("simplify() simplifies 6/4 to 3/2", () => {
    const frac = new Fraction(6, 4);
    frac.simplify();

    expect([frac.n, frac.d]).toEqual([3, 2]);
});

test("add() and subtract() correctly evaluates 4/3 + 9/2 - 3/4 = 61/12", () => {
    const frac1 = new Fraction(4, 3);
    const frac2 = new Fraction(9, 2);
    const frac3 = new Fraction(3, 4);

    const result = frac1.add(frac2).subtract(frac3);

    expect([result.n, result.d]).toEqual([61, 12]);
});

test("multiply() and divide() correctly evaluates 7/3 * 4/1 / 8/5 = 35/6", () => {
    const frac1 = new Fraction(7, 3);
    const frac2 = new Fraction(4, 1);
    const frac3 = new Fraction(8, 5);

    const result = frac1.multiply(frac2).divide(frac3);

    expect([result.n, result.d]).toEqual([35, 6]);
});

test("negate() correctly flips the sign of 3/2", () => {
    const neg = (new Fraction(3, 2)).negate();

    expect([neg.n, neg.d]).toEqual([-3, 2]);
});

test("compareTo() correctly compares 3/4 > 2/3", () => {
    const bigger = new Fraction(3, 4);
    const smaller = new Fraction(2, 3);

    expect(bigger.compareTo(smaller)).toBeGreaterThan(0);
})