import { db } from "@/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export async function initializeUser(
    name: string,
    userID: string,
    email: string
) {
    try {
        const userRef = doc(db, "users", userID);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            await setDoc(userRef, {
                name,
                email,
                kamis: []
            } as User);
        } else {
            throw new Error("User already exists.");
        }
    } catch (err) {
        return err as Error;
    }
}