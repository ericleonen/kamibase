import { getViewableKami } from "@/db/kami/read";
import { EditableKami, ReadOnlyKami } from "@/db/kami/schemas";
import { User } from "@/db/user/schemas";
import { atom } from "jotai"

export const editableKamiAtom = atom<EditableKami>({
    title: "",
    kamiString: "",
    public: false,
    description: ""
}); 

export const viewableKamiAtom = atom<ReadOnlyKami>({
    kamiID: "",
    title: "",
    author: {} as User,
    imageSrc: "",
    description: ""
});

export const loadViewableKamiAtom = atom(null, async (get, set, kamiID: string) => {
    if (get(viewableKamiAtom).kamiID !== kamiID) {
        set(viewableKamiAtom, await getViewableKami(kamiID));
    }
});

/**
 * Type for different types of tools: (M)ountain, (V)alley, (N)eutral, and (E)raser.
 */
export type Tool = "M" | "V" | "N" | "E";

/**
 * Atom that stores information about the Kami editor's tool.
 */
export const toolAtom = atom<Tool>("M");