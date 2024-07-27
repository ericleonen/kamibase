import { useEffect, useState } from "react";
import { collection, doc, documentId, getDoc, getDocs, query, where } from "firebase/firestore";
import { db, storage } from "@/firebase";
import { initialEditableKamiState, initialViewableKamiState, useSetEditableKami, useSetViewableKami, viewableKamiAtom } from "@/atoms/kami";
import { Kami, ViewableKami } from "./schemas";
import { usePathname } from "next/navigation";
import { User } from "../user/schemas";
import { getKamiImage } from "@/storage/kami/read";
import { useAtom, useAtomValue } from "jotai";
import { ref } from "firebase/storage";

/**
 * Custom hook that reads and returns the requested kamiID from the URL path.
 */
export function usePathKamiID(): string {
    const path = usePathname();
    const segments = path.split("/");

    return segments[segments.length - 1];
}

/**
 * Custom hook that uses the setKami setter to load the specified Kami data into an atom.
 */
export function useLoadEditableKami(kamiID: string) {
    const setKami = useSetEditableKami();
    
    useEffect(() => {
        setKami({ ...initialEditableKamiState, loadStatus: "loading" });

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

/**
 * Custom hook that provides a list of all public Kami data and loading and error information.
 */
export function usePublicKamis(): {
    isLoading: boolean,
    list: ViewableKami[],
    error?: Error
} {
    const [isLoading, setIsLoading] = useState(true);
    const [list, setList] = useState<ViewableKami[]>([]);
    const [error, setError] = useState<Error>();

    useEffect(() => {
        setIsLoading(true);

        (async () => {
            try {
                const kamisRef = collection(db, "kamis");
                const publicQuery = query(kamisRef, where("public", "==", true));

                // handle kamiID, title, and userID
                const publicKamisSnap = await getDocs(publicQuery);
                const relevantUserIDs = new Set<string>();
                const publicKamis: ViewableKami[] = [];

                for (let publicKamiSnap of publicKamisSnap.docs) {
                    const publicKami = publicKamiSnap.data() as Kami;

                    publicKamis.push({
                        kamiID: publicKamiSnap.id,
                        title: publicKami.title,
                        userID: publicKami.userID,
                        userName: "",
                        src: await getKamiImage(publicKamiSnap.id)
                    });

                    relevantUserIDs.add(publicKami.userID);
                }

                // handle userName
                const usersRef = collection(db, "users");
                const relevantQuery = query(usersRef, where(documentId(), "in", Array.from(relevantUserIDs)));

                const userIDToNameMap: { [userID: string]: string } = {};
                const relevantUsersSnap = await getDocs(relevantQuery);

                relevantUsersSnap.forEach(relevantUserSnap => {
                    const relevantUser = relevantUserSnap.data() as User;
                    userIDToNameMap[relevantUser.userID] = relevantUser.name;
                });

                setIsLoading(false);
                setList(publicKamis.map(publicKami => ({
                    ...publicKami,
                    userName: userIDToNameMap[publicKami.userID]
                })));
            } catch (err) {
                setIsLoading(false);
                setError(err as Error);
            }
        })();
    }, []);

    return { isLoading, list, error };
}

/**
 * Accepts a kamiID and returns a Promise that resolves to a ViewableKami data.
 */
async function getViewableKami(kamiID: string): Promise<ViewableKami> {
    const kamiRef = doc(db, "kamis", kamiID);
    const kamiSnap = await getDoc(kamiRef);
    const { userID, title } = kamiSnap.data() as Kami;

    const userRef = doc(db, "users", userID);
    const userSnap = await getDoc(userRef);
    const { name } = userSnap.data() as User;

    const src = await getKamiImage(kamiID);

    return {
        userID,
        title,
        kamiID,
        userName: name,
        src
    };
}

export function useLoadViewableKami(kamiID: string) {
    const viewableKami = useAtomValue(viewableKamiAtom);
    const setViewableKami = useSetViewableKami();

    useEffect(() => {
        if (viewableKami.kamiID !== kamiID) {
            setViewableKami({
                ...initialViewableKamiState,
                loadStatus: "loading" 
            });

            getViewableKami(kamiID)
                .then(viewableKami => {
                    setViewableKami({
                        ...viewableKami,
                        loadStatus: "succeeded"
                    });
                })
                .catch(err => {
                    setViewableKami({
                        loadStatus: "failed",
                        error: err
                    });
                });
        }
    }, [viewableKami.loadStatus, setViewableKami]);
}