import { round } from "./math";

/**
 * Capitalizes the first letter of a string and returns it. If str is empty, throws an Error.
 */
export function capitalize(str: string) {
    if (str.length === 0) {
        throw new Error("str cannot be empty");
    }

    return str.charAt(0).toUpperCase() + str.substring(1);
}

/**
 * Converts the given string or number arguments into a string key. Items are separated by spaces
 * and numbers are rounded.
 */
export function listKey(...items: (string | number)[]) {
    return items.map(item => {
        if (typeof item === "number") {
            return round(item);
        } else {
            return item;
        }
    }).join(" ");
}