import { round } from "./math";

/**
 * Capitalizes the first letter of a string and returns the string
 * @param str Word string to capitalize
 */
export function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.substring(1);
}

/**
 * Returns a list key of the items
 * @param items List of items
 */
export function listKey(...items: any[]) {
    return items.map(item => {
        if (typeof item === "number") {
            return round(item);
        } else {
            return item;
        }
    }).join(" ");
}