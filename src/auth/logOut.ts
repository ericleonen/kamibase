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
    };

    return { isLoggingOut, logOut };
}