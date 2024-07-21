import { kamiAtom, useSetKami } from "@/atoms/kami";
import { db } from "@/firebase";
import { createKamiImage } from "@/storage/kamis/create";
import { doc, updateDoc } from "firebase/firestore";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";

/**
 * Custom hook that provides a function to save a Kami given its kamiID.
 */
export function useSaveKami(kamiID: string): () => Promise<void> {
    const kami = useAtomValue(kamiAtom);
    const setKami = useSetKami();

    const [newKamiImageNeeded, setNewKamiImageNeeded] = useState(true);

    useEffect(() => {
        setNewKamiImageNeeded(true);
    }, [kami.kamiString]);

    const save = useCallback(async () => {
        // do not save when you are already saving or deleting the Kami
        if (kami.saveStatus !== "unsaved") return;

        setKami({ saveStatus: "saving" });

        try {
            // update Firestore
            const kamiRef = doc(db, "kamis", kamiID);
            await updateDoc(kamiRef, {
                title: kami.title,
                kamiString: kami.kamiString
            });

            if (newKamiImageNeeded) {
                await createKamiImage(kamiID, kami.kamiString);
                setNewKamiImageNeeded(false);
            }

            setKami({ saveStatus: "saved" });
        } catch (err) {
            setKami({
                saveStatus: "failed",
                error: err as Error
            });
        }
    }, [newKamiImageNeeded]);

    return save;
}

export function useKamiPublicityToggler(kamiID: string): {
    inProgress: boolean,
    toggle: () => Promise<void>
} {
    const kami = useAtomValue(kamiAtom);
    const setKami = useSetKami();

    const [inProgress, setInProgress] = useState(false);

    const toggle = async () => {
        setInProgress(true);

        try {
            const kamiRef = doc(db, "kamis", kamiID);
            await updateDoc(kamiRef, {
                public: !kami.public
            });

            setKami({ public: !kami.public });
            setInProgress(false);
        } catch (err) {
            setInProgress(false);
            setKami({ error: err as Error });
        }
    }

    return { inProgress, toggle };
}