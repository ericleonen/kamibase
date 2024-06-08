import Fraction from "./Fraction";

/**
 * Represents a Vector object with vector algrebraic operations.
 */
export default class Vector {
    x: Fraction;
    y: Fraction;

    /**
     * Initializes a Vector object <x, y>
     * @param x Horizontal Fraction component
     * @param y Vertical Fraction component
     */
    constructor(x: Fraction, y: Fraction) {
        this.x = x;
        this.y = y;
    }
}