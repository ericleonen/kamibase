import { User } from "@/db/user/schemas";
import { adminAuth } from "@/firebase/admin";
import { cookies } from "next/headers";
import { cache } from "react";

export const getAuthenticatedUser = async () => {
    const sessionCookie = cookies().get("__session")?.value || "";

    try {
        const { uid } = await adminAuth.verifySessionCookie(sessionCookie);
        const user = await adminAuth.getUser(uid);

        return {
            uid,
            name: user.displayName || "",
            photoURL: user.photoURL || ""
        } as User;
    } catch (err) {
        console.log("Invalid cookies");
        return null;
    }
};