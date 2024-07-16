import { Kami } from "@/db/kami/schemas";
import { Resource } from "@/atoms/types";
import { atom, useSetAtom } from "jotai";

export const initialKamiState: Kami & Resource = {
    title: "",
    userID: "",
    kamiString: "",
    visibility: "private",
    loadStatus: "idle",
    saveStatus: "saved",
    error: undefined
};

/**
 * Atom that stores the information about the current editable Kami.
 */
export const kamiAtom = atom<Kami & Resource>(initialKamiState);

/**
 * Custom hook that provides a setter that allows you to target specific fields of the kamiAtom.
 */
export function useSetKami(): (kami: Partial<Kami & Resource>) => void {
    const setKami = useSetAtom(kamiAtom);

    return (kami: Partial<Kami & Resource>) => {
        setKami(prevKami => ({ ...prevKami, ...kami }));
    };
}