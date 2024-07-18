import { storage } from "@/firebase";
import Kami from "@/origami/Kami";
import Point from "@/origami/Point";
import { render } from "@/origami/render";
import { DEFAULT_KAMI_DIMS, PIXEL_DENSITY } from "@/settings";
import { ref, uploadBytes } from "firebase/storage";

/**
 * Given the kamiID and kamiString, saves a KamiImage to Storage. Throws an error if something
 * goes wrong.
 */
export async function createKamiImage(kamiID: string, kamiString: string) {
    const kamiImagesRef = ref(storage, `kamis/${kamiID}.png`);

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = DEFAULT_KAMI_DIMS * PIXEL_DENSITY;
    const context = canvas.getContext("2d");
    
    if (!context) {
        throw new Error("Canvas Context is null.");
    }

    const origin = new Point(0, 0);
    
    render(canvas, context, {
        kami: Kami.fromString(kamiString),
        origin,
        kamiDims: canvas.width,
        background: true
    });

    canvas.toBlob(kamiBlob => {
        if (kamiBlob) {
            uploadBytes(kamiImagesRef, kamiBlob);
        }
    });
}