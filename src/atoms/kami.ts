import { Kami } from "@/db/kami/schemas";
import { Resource } from "@/atoms/types";
import { atom, useSetAtom } from "jotai";

/**
 * Atom that stores the information about the current editable Kami.
 */
export const kamiAtom = atom<Kami & Resource>({
    title: "",
    userID: "",
    kamiString: "",
    visibility: "private",
    loadStatus: "idle",
    saveStatus: "saved"
});

/**
 * Custom hook that provides a function to update the Kami atom's kamiString field.
 */
export function useSetKamiString() {
    const setKami = useSetAtom(kamiAtom);

    return (kamiString: string) => {
        setKami(prevKami => ({
            ...prevKami,
            kamiString
        }));
    };
}