import { db } from "@/firebase";
import { addDoc, collection } from "firebase/firestore";
import { useState } from "react"
import { Kami } from "./schemas";
import { useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import { userAtom } from "@/atoms/user";

/**
 * Custom hook that provides a create Kami function and a progress state.
 */
export function useCreateKami(): { 
    isCreating: boolean, 
    create: (title?: string, baseKamiString?: string) => void
} {
    const [isCreating, setIsCreating] = useState(false);
    const user = useAtomValue(userAtom);
    const router = useRouter();

    const create = async (title?: string, baseKamiString?: string) => {
        setIsCreating(true);

        const kamisRef = collection(db, "kamis");
        const newKamiRef = await addDoc(kamisRef, {
            title: title || "Untitled kami",
            authorUid: user?.uid,
            kamiString: baseKamiString || "",
            public: false,
            imageURL: "",
            description: ""
        } as Kami);
        const newKamiID = newKamiRef.id;

        router.replace(`/editor/${newKamiID}`);

        setIsCreating(false);
    }

    return { isCreating, create };
}