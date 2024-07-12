import { db } from "@/firebase";
import { addDoc, arrayUnion, collection, doc, setDoc, updateDoc } from "firebase/firestore";
import { useState } from "react"
import { Kami } from "./schemas";
import { useAtomValue } from "jotai";
import { userAtom } from "@/atoms/auth";
import { useRouter } from "next/navigation";

/**
 * Custom hook that provides kami creation functionality and information: whether the process of
 * kami creation is happening and the error. 
 */
export function useCreateKami(): { 
    isCreatingKami: boolean, 
    createKami: (title?: string, baseKamiString?: string) => void,
    error?: Error
} {
    const [isCreatingKami, setIsCreatingKami] = useState(false);
    const [error, setError] = useState<Error>();
    const { userID } = useAtomValue(userAtom);
    const router = useRouter();

    const createKami = async (title?: string, baseKamiString?: string) => {
        try {
            setIsCreatingKami(true);

            const kamisRef = collection(db, "kamis");
            const newKamiRef = await addDoc(kamisRef, {
                title: title || "Untitled kami",
                userID,
                kamiString: baseKamiString || "",
                visibility: "private"
            } as Kami);
            const newKamiID = newKamiRef.id;

            const userRef = doc(db, "users", userID);
            await updateDoc(userRef, {
                kamiIDs: arrayUnion(newKamiID)
            });

            router.push(`/app/editor/${newKamiID}`)
        } catch (err) {
            console.error(err)
            setError(err as Error)
        }
    }

    return { isCreatingKami, createKami, error };
}