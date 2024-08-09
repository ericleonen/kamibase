import { User } from "@/db/user/schemas";
import { atom } from "jotai";

/**
 * Atom containing null if the user is not authenticated or User data otherwise.
 */
export const userAtom = atom<User | null>(null);