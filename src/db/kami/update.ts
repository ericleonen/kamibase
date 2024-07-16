import { drawRectangle, render } from "@/app/app/editor/KamiDisplay/render";
import { kamiAtom, useSetKami } from "@/atoms/kami";
import { db, storage } from "@/firebase";
import Kami from "@/origami/Kami";
import Point from "@/origami/Point";
import { DEFAULT_KAMI_DIMS, PIXEL_DENSITY } from "@/settings";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
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
                visibility: kami.visibility
            });

            // update Kami icon in Storage
            const kamiImagesRef = ref(storage, `kamis/${kamiID}.png`);

            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = DEFAULT_KAMI_DIMS * PIXEL_DENSITY;
            const context = canvas.getContext("2d");
            
            if (!context) {
                throw new Error("Canvas Context is null.");
            }

            const origin = new Point(0, 0);
            
            render(canvas, context, {
                kami: Kami.fromString(kami.kamiString),
                origin,
                kamiDims: canvas.width,
                background: true
            });

            canvas.toBlob(kamiBlob => {
                if (kamiBlob) {
                    uploadBytes(kamiImagesRef, kamiBlob);
                }
            });

            setKami({ saveStatus: "saved" });
        } catch (err) {
            setKami({
                saveStatus: "failed",
                error: err as Error
            });
        }
    }
}