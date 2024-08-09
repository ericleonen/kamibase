import { auth } from "@/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthenticatedUser } from "./read";

/**
 * Custom hook that reroutes user to given href if they are authenticated.
 */
export function useAuthenticatedReroute(href: string) {
    const router = useRouter();
    const user = useAuthenticatedUser();

    useEffect(() => {
        if (user) {
            router.replace(href);
        }
    }, [user]);
}

/**
 * Logs in a user with given email and password.
 */
async function logInLocally(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
}

/**
 * Custom hook that provides a log in functiion and progress state.
 */
export function useLogIn(): {
    isLoggingIn: boolean,
    logIn: (email: string, password: string) => void
} {
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const logIn = async (email: string, password: string) => {
        setIsLoggingIn(true);

        await logInLocally(email, password);

        setIsLoggingIn(false);
    }

    return { isLoggingIn, logIn };
}