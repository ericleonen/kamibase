import { auth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";

/**
 * Custom hook that provides a log out function and whether or not the logging out process is
 * taking place.
 */
export function useLogOut(): {
    isLoggingOut: boolean,
    logOut: () => void
} {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const router = useRouter();

    const logOut = async () => {
        setIsLoggingOut(true);
        await signOut(auth);
        router.push("/");
    };

    return { isLoggingOut, logOut };
}

/**
 * Custom hook that logs an unauthenticated user out, returning them to the KamiBase's "/" route.
 */
export function useAutoLogOut() {
    const router = useRouter();
    const [authUser, authLoading, authError] = useAuthState(auth);

    useEffect(() => {
        if (!authUser && !authLoading) {
            router.push("/");
        }
    }, [authUser, authLoading]);
}