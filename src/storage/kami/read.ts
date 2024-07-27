import { storage } from "@/firebase";
import { getDownloadURL, ref } from "firebase/storage";
import { useEffect, useState } from "react";

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

export function useKamiImage(kamiID: string): {
    isDownloading: boolean,
    src: string,
    error?: Error
} {
    const [isDownloading, setIsDownloading] = useState(false);
    const [src, setSrc] = useState("");
    const [error, setError] = useState<Error>();

    useEffect(() => {
        const kamiImageRef = ref(storage, `kamis/${kamiID}.png`);
        setIsDownloading(true);

        getDownloadURL(kamiImageRef)
            .then(url => {
                setSrc(url);
                setIsDownloading(false);
            })
            .catch(err => {
                setIsDownloading(false);
                setError(err);
            })
    }, [kamiID]);

    return { isDownloading, src, error };
}