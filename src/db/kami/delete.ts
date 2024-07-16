import { kamiAtom, useSetKami } from "@/atoms/kami";
import { db } from "@/firebase";
import { deleteDoc, doc } from "firebase/firestore";
import { useAtomValue } from "jotai"
import { useRouter } from "next/navigation";

export function useDeleteKami(kamiID: string): () => Promise<void> {
    const kamiSaveStatus = useAtomValue(kamiAtom).saveStatus;
    const setKami = useSetKami();
    const router = useRouter();

    return async () => {
        if (kamiSaveStatus === "deleting") return;

        setKami({ saveStatus: "deleting" });

        try {
            const kamiRef = doc(db, "kamis", kamiID);
            await deleteDoc(kamiRef);

            router.push("/app/home");
        } catch (err) {
            setKami({
                saveStatus: "failed",
                error: err as Error
            });
        }
    };
}