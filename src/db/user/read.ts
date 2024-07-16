import { useSetUser, userAtom } from "@/atoms/auth";
import { auth, db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { User } from "./schemas";

/**
 * Custom hook that loads a logged-in user's data into the user atom.
 */
export function useLoadUser() {
    const [authUser, authLoading, authError] = useAuthState(auth);
    const userLoadStatus = useAtomValue(userAtom).loadStatus;
    const setUser = useSetUser();

    useEffect(() => {
        if (!authUser || authLoading || authError) return;

        if (userLoadStatus === "idle") {
            setUser({ loadStatus: "loading" });

            const userRef = doc(db, "users", authUser.uid);
            getDoc(userRef)
                .then(userSnap => {
                    setUser({
                        ...(userSnap.data() as User),
                        loadStatus: "succeeded",
                    });
                })
                .catch(err => {
                    setUser({
                        loadStatus: "failed",
                        error: err
                    });
                });
        }
    }, [authUser, authLoading, authError, userLoadStatus]);
}