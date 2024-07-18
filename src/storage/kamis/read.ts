import { storage } from "@/firebase";
import { getDownloadURL, ref } from "firebase/storage";
import { useEffect, useState } from "react";

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