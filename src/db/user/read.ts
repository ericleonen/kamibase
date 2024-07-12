import { useSetUserLoadStatus, userAtom } from "@/atoms/auth";
import { auth, db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { User } from "./schemas";

/**
 * Custom hook that loads a logged-in user's data into the user atom. Returns an Error if something
 * went wrong, otherwise undefined.
 */
export function useLoadUser(): Error | undefined {
    const [authUser, authLoading, authError] = useAuthState(auth);
    const [user, setUser] = useAtom(userAtom);
    const setUserLoadStatus = useSetUserLoadStatus();

    const [error, setError] = useState<Error>();

    useEffect(() => {
        if (!authUser || authLoading || authError) return;

        if (user.loadStatus === "idle") {
            setUserLoadStatus("loading")

            const userRef = doc(db, "users", authUser.uid);
            getDoc(userRef)
                .then(userSnap => {
                    setUser(prevUser => ({
                        ...prevUser,
                        ...(userSnap.data() as User),
                        loadStatus: "succeeded",
                    }));
                })
                .catch(err => {
                    setUserLoadStatus("failed")
                    setError(err);
                });
        }
    }, [authUser, authLoading, authError, user.loadStatus]);

    return error;
}