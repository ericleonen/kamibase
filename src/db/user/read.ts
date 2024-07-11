import { useUserLoadStatus, userAtom } from "@/auth/atoms";
import { auth, db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAtom, useSetAtom } from "jotai";
import { useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { User } from "./schemas";

export function useLoadUser() {
    const [authUser, authLoading, authError] = useAuthState(auth);
    const setUser = useSetAtom(userAtom);
    const { userLoadStatus, setUserLoadStatus } = useUserLoadStatus();

    useEffect(() => {
        if (!authUser || authLoading || authError) return;

        if (userLoadStatus === "idle") {
            setUserLoadStatus("loading");

            const userRef = doc(db, "users", authUser.uid);
            getDoc(userRef)
                .then(userSnap => {
                    console.log(userSnap.data())

                    setUser(prevUser => ({
                        ...prevUser,
                        ...(userSnap.data() as User),
                        loadStatus: "succeeded",
                    }));
                })
                .catch(err => {
                    setUserLoadStatus("failed");
                    console.error(err);
                });
        }
    }, [authUser, authLoading, authError, userLoadStatus]);
}