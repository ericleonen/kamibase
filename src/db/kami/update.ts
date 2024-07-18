import { kamiAtom, useSetKami } from "@/atoms/kami";
import { db } from "@/firebase";
import { createKamiImage } from "@/storage/kamis/create";
import { doc, updateDoc } from "firebase/firestore";
import { useAtomValue } from "jotai";

/**
 * Custom hook that provides a function to save a Kami given its kamiID.
 */
export function useSaveKami(kamiID: string): () => Promise<void> {
    const kami = useAtomValue(kamiAtom);
    const setKami = useSetKami();

    return async () => {
        // do not save when you are already saving or deleting the Kami
        if (kami.saveStatus !== "unsaved") return;

        setKami({ saveStatus: "saving" });

        try {
            // update Firestore
            const kamiRef = doc(db, "kamis", kamiID);
            await updateDoc(kamiRef, {
                title: kami.title,
                kamiString: kami.kamiString,
                public: kami.public
            });

            await createKamiImage(kamiID, kami.kamiString);

            setKami({ saveStatus: "saved" });
        } catch (err) {
            setKami({
                saveStatus: "failed",
                error: err as Error
            });
        }
    }
}