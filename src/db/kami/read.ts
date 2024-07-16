import { useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { initialKamiState, useSetKami } from "@/atoms/kami";
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
 * Custom hook that uses the setKami setter to load the specified Kami data into an atom.
 */
export function useLoadKami(kamiID: string) {
    const setKami = useSetKami();
    
    useEffect(() => {
    setKami({ ...initialKamiState, loadStatus: "loading" });

        const kamiRef = doc(db, "kamis", kamiID);
        getDoc(kamiRef)
            .then(kamiSnap => {
                setKami({
                    ...(kamiSnap.data() as Kami),
                    loadStatus: "succeeded"
                });
            })
            .catch(err => {
                setKami({ 
                    loadStatus: "failed",
                    error: err
                });
            })
    }, [kamiID]);
}