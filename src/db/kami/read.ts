import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { useAtom } from "jotai";
import { kamiAtom } from "@/atoms/kami";
import { Kami } from "./schemas";
import { usePathname } from "next/navigation";

/**
 * Custom hook that reads and returns the requested kamiID from the URL path.
 */
export function usePathKamiID(): string {
    const path = usePathname();
    const kamiID = path.split("/")[3];

    return kamiID;
}

/**
 * Custom hook that uses the setKami setter to load the specified Kami data into an atom. If
 * loading is unsuccessful, returns an Error, otherwise undefined.
 */
export function useLoadKami(kamiID: string): Error | undefined {
    const [kami, setKami] = useAtom(kamiAtom);
    const [error, setError] = useState<Error>();
    
    useEffect(() => {
        if (kami.loadStatus === "idle") {
            setKami(prevKami => ({ ...prevKami, loadStatus: "loading" }));

            const kamiRef = doc(db, "kamis", kamiID);
            getDoc(kamiRef)
                .then(kamiSnap => {
                    setKami(prevKami => ({
                        ...prevKami,
                        ...(kamiSnap.data() as Kami),
                        loadStatus: "succeeded"
                    }));
                })
                .catch(err => {
                    setKami(prevKami => ({ ...prevKami, loadStatus: "failed" }));
                    setError(err);
                })
        }
    }, [kamiID, kami.loadStatus]);

    return error;
}