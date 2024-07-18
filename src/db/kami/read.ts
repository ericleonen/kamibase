import { useEffect, useState } from "react";
import { FieldPath, collection, doc, documentId, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase";
import { initialKamiState, useSetKami } from "@/atoms/kami";
import { Kami } from "./schemas";
import { usePathname } from "next/navigation";
import { User } from "../user/schemas";

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

export type PublicKami = {
    kamiID: string,
    title: string,
    userID: string,
    userName: string
};

/**
 * Custom hook that provides a list of all public Kami data and loading and error information.
 */
export function usePublicKamis(): {
    isLoading: boolean,
    list: PublicKami[],
    error?: Error
} {
    const [isLoading, setIsLoading] = useState(true);
    const [kamis, setKamis] = useState<PublicKami[]>([]);
    const [error, setError] = useState<Error>();

    useEffect(() => {
        setIsLoading(true);

        (async () => {
            try {
                const kamisRef = collection(db, "kamis");
                const publicQuery = query(kamisRef, where("public", "==", true));

                const publicKamisSnap = await getDocs(publicQuery);
                const relevantUserIDs = new Set<string>();
                const publicKamis: PublicKami[] = [];

                publicKamisSnap.forEach(publicKamiSnap => {
                    const publicKami = publicKamiSnap.data() as Kami;

                    publicKamis.push({
                        kamiID: publicKamiSnap.id,
                        title: publicKami.title,
                        userID: publicKami.userID,
                        userName: ""
                    });

                    relevantUserIDs.add(publicKami.userID);
                });

                const usersRef = collection(db, "users");
                const relevantQuery = query(usersRef, where(documentId(), "in", Array.from(relevantUserIDs)));

                const userIDToNameMap: { [userID: string]: string } = {};

                const relevantUsersSnap = await getDocs(relevantQuery);

                relevantUsersSnap.forEach(relevantUserSnap => {
                    const relevantUser = relevantUserSnap.data() as User;
                    userIDToNameMap[relevantUser.userID] = relevantUser.name;
                });

                setKamis(
                    publicKamis.map(publicKami => ({
                        ...publicKami,
                        userName: userIDToNameMap[publicKami.userID]
                    }))
                );
                setIsLoading(false);
            } catch (err) {
                setIsLoading(false);
                setError(err as Error);
            }
        })();
    }, []);

    return {
        isLoading,
        list: kamis,
        error
    };
}