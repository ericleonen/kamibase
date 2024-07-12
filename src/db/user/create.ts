import { db } from "@/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { User } from "./schemas";

/**
 * Creates a new user given the name, userID, and email into Firestore. Returns a Promise that
 * resolves to an Error if something goes wrong, otherwise undefined.
 */
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
                userID,
                email,
                kamiIDs: [] as string[]
            } as User);
        } else {
            throw new Error("User already exists.");
        }
    } catch (err) {
        return err as Error;
    }
}