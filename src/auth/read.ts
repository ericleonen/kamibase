import { User } from "@/db/user/schemas";
import { adminAuth } from "@/firebase/admin";
import { cookies } from "next/headers";
import { cache } from "react";

export const getAuthenticatedUser = cache(async () => {
    const idToken = cookies().get("authToken")?.value || "";

    try {
        const { uid } = await adminAuth.verifyIdToken(idToken);
        const user = await adminAuth.getUser(uid);

        return {
            uid,
            name: user.displayName || "",
            photoURL: user.photoURL || ""
        } as User;
    } catch (err) {
        return null;
    }
});