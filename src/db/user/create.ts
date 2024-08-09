import { db } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";

export async function createUser(uid: string, name: string) {
    const userRef = doc(db, "users", uid);
    
    await setDoc(userRef, {
        uid,
        displayName: name,
        photoURL: ""
    });
}