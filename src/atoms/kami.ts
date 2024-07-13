import { Kami } from "@/db/kami/schemas";
import { Resource, SaveStatus } from "@/atoms/types";
import { atom, useAtom, useSetAtom } from "jotai";

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
 * Custom hook that provides the state and state setter of the Kami atom's title field.
 */
export function useKamiTitle() {
    const [kami, setKami] = useAtom(kamiAtom);

    return {
        kamiTitle: kami.title,
        setKamiTitle: (kamiTitle: string) => {
            setKami(prevKami => ({
                ...prevKami,
                title: kamiTitle
            }));
        }
    };
}

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

/**
 * Custom hook that provides the state and state setter of the Kami atom's saveStatus field. 
 */
export function useKamiSaveStatus() {
    const [kami, setKami] = useAtom(kamiAtom);

    return {
        kamiSaveStatus: kami.saveStatus,
        setKamiSaveStatus: (kamiSaveStatus: SaveStatus) => {
            setKami(prevKami => ({
                ...prevKami,
                saveStatus: kamiSaveStatus
            }));
        }
    };
}