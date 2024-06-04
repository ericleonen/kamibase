/**
 * Capitalizes the first letter of a string and returns the string
 * @param str Word string to capitalize
 */
export function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.substring(1);
}