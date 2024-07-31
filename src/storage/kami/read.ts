import { storage } from "@/firebase";
import { getDownloadURL, ref } from "firebase/storage";

/**
 * Accepts a kamiIDs and returns a Promise that each either resolve to the src string or an Error.
 */
export async function getKamiImage(kamiID: string): Promise<string> {
    const kamiImageRef = ref(storage, `kamis/${kamiID}.png`);
    
    try {
        return await getDownloadURL(kamiImageRef);
    } catch (err) {
        throw (err as Error);
    }
}