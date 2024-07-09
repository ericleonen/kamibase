import { auth } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";

export function useAutoLogIn() {
    const router = useRouter();
    const [authUser, authLoading, authError] = useAuthState(auth);

    useEffect(() => {
        if (authUser && !authLoading && !authError) {
            router.push("/home");
        }
    }, [authUser, authLoading, authError]);
}