"use client"

import { userAtom } from "@/atoms/user";
import { useSetAtom } from "jotai";
import { ReactNode, useEffect } from "react"
import nookies from "nookies";
import { auth } from "@/firebase";
import { onIdTokenChanged } from "firebase/auth";

type AuthProviderProps = {
    children: ReactNode
}

export default function AuthProvider({ children }: AuthProviderProps) {
    const setUser = useSetAtom(userAtom);

    useEffect(() => {
        const unsubscribe = onIdTokenChanged(auth, async (user) => {
            setUser({
                uid: user?.uid || "",
                name: user?.displayName || "",
                photoURL: user?.photoURL || ""
            });

            const token = user ? await user.getIdToken() : "";
            nookies.set(undefined, "authToken", token, { path: "/" });
        });

        return () => unsubscribe();
    }, [setUser]);

    useEffect(() => {
        const refresh = setInterval(async () => {
            const user = auth.currentUser;

            if (user)
                await user.getIdToken(true);
        }, 10 * 60 * 1000);

        return () => clearInterval(refresh);
    });

    return children;
}