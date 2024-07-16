import { Resource } from "@/atoms/types";
import { User } from "@/db/user/schemas";
import { atom, useSetAtom } from "jotai";

/**
 * Atom that stores information about the logged-in user. For a user without an account, the
 * loading status will be idle.
 */
export const userAtom = atom<User & Resource>({
    name: "",
    email: "",
    userID: "",
    loadStatus: "idle",
    saveStatus: "saved",
    error: undefined
});

/**
 * Custom hook that provides a setter that allows you to target specific fields of the kamiAtom.
 */
export function useSetUser(): (user: Partial<User & Resource>) => void {
    const setUser = useSetAtom(userAtom);

    return (user: Partial<User & Resource>) => {
        setUser(prevUser => ({ ...prevUser, ...user }));
    };
}