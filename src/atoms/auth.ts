import { LoadStatus, Resource } from "@/atoms/types";
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
    kamiIDs: [] as string[],
    loadStatus: "idle",
    saveStatus: "saved"
});

/**
 * Custom hook that provides a function to update the user atom's load status.
 */
export function useSetUserLoadStatus(): (userLoadStatus: LoadStatus) => void {
    const setUser = useSetAtom(userAtom);

    return (userLoadStatus: LoadStatus) => {
        setUser(prevUser => ({ ...prevUser, loadStatus: userLoadStatus }));
    }
}