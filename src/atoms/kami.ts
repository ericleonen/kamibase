import { Kami } from "@/db/kami/schemas";
import { Resource } from "@/atoms/types";
import { atom, useSetAtom } from "jotai";

export const initialKamiState: Kami & Resource = {
    title: "",
    userID: "",
    kamiString: "",
    public: false,
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

/**
 * Type for different types of tools: (M)ountain, (V)alley, (N)eutral, and (E)raser.
 */
export type Tool = "M" | "V" | "N" | "E";

/**
 * Atom that stors information about the Kami editor's tool.
 */
export const toolAtom = atom<Tool>("M");