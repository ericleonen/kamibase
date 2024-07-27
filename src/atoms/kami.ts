import { Kami, ViewableKami } from "@/db/kami/schemas";
import { Resource } from "@/atoms/types";
import { atom, useSetAtom } from "jotai";

export const initialEditableKamiState: Kami & Resource = {
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
export const editableKamiAtom = atom<Kami & Resource>(initialEditableKamiState);

/**
 * Custom hook that provides a setter that allows you to target specific fields of the kamiAtom.
 */
export function useSetEditableKami(): (kami: Partial<Kami & Resource>) => void {
    const setEditableKami = useSetAtom(editableKamiAtom);

    return (editableKami: Partial<Kami & Resource>) => {
        setEditableKami(prevEditableKami => ({ ...prevEditableKami, ...editableKami }));
    };
}

export const initialViewableKamiState: ViewableKami & Resource = {
    kamiID: "",
    title: "",
    userID: "",
    userName: "",
    src: "",
    loadStatus: "idle",
    saveStatus: "saved",
    error: undefined
}

export function useSetViewableKami(): (viewableKami: Partial<ViewableKami & Resource>) => void {
    const setViewableKami = useSetAtom(viewableKamiAtom);

    return (viewableKami: Partial<ViewableKami & Resource>) => {
        setViewableKami(prevViewableKami => ({ ...prevViewableKami, ...viewableKami }));
    };
}

/**
 * Atom that stores the information about the current viewable Kami.
 */
export const viewableKamiAtom = atom<ViewableKami & Resource>(initialViewableKamiState);

/**
 * Type for different types of tools: (M)ountain, (V)alley, (N)eutral, and (E)raser.
 */
export type Tool = "M" | "V" | "N" | "E";

/**
 * Atom that stores information about the Kami editor's tool.
 */
export const toolAtom = atom<Tool>("M");