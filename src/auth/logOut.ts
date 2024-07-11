import { auth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";

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

export function useAutoLogOut() {
    const router = useRouter();
    const [authUser, authLoading, authError] = useAuthState(auth);

    useEffect(() => {
        if (!authUser && !authLoading) {
            router.push("/");
        }
    }, [authUser, authLoading]);
}