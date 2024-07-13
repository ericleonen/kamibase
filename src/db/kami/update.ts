import { kamiAtom, useKamiSaveStatus } from "@/atoms/kami";
import { db } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useAtomValue } from "jotai";
import { useState } from "react";

/**
 * Custom hook that provides a function to save a Kami, given its kamiID, and the error.
 */
export function useSaveKami(kamiID: string): {
    saveKami: () => void,
    saveKamiError?: Error
} {
    const kami = useAtomValue(kamiAtom);
    const { kamiSaveStatus, setKamiSaveStatus } = useKamiSaveStatus();

    const [error, setError] = useState<Error>();

    const saveKami = async () => {
        // do not save when you are already saving or deleting the Kami
        if (kamiSaveStatus !== "unsaved") return;

        setKamiSaveStatus("saving");

        try {
            const kamiRef = doc(db, "kamis", kamiID);
            console.log(kami);

            await updateDoc(kamiRef, {
                title: kami.title,
                kamiString: kami.kamiString,
                visibility: kami.visibility
            });

            setKamiSaveStatus("saved");
        } catch (err) {
            setKamiSaveStatus("failed");
            setError(err as Error);
        }
    }

    return {
        saveKami,
        saveKamiError: error
    }
}