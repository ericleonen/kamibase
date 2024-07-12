import { auth } from "@/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";

/**
 * Custom hook that logs authenticated users in and takes them to the home page.
 */
export function useAutoLogIn() {
    const router = useRouter();
    const [authUser, authLoading, authError] = useAuthState(auth);

    useEffect(() => {
        if (authUser && !authLoading && !authError) {
            router.push("/app/home");
        }
    }, [authUser, authLoading, authError]);
}

/**
 * Logs in a user with given email and password. Returns a Promise that resolves to an Error if
 * something goes wrong, undefined otherwise.
 */
async function logInLocally(email: string, password: string) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        return err as Error;
    }
}

/**
 * Custom hook that provides login functionality and information: whether or not the process of
 * logging in is happening and the error.
 */
export function useLogIn(): {
    isLoggingIn: boolean,
    logIn: (email: string, password: string) => void,
    error?: Error
} {
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [error, setError] = useState<Error>();

    const logIn = async (email: string, password: string) => {
        setIsLoggingIn(true);

        const error = await logInLocally(email, password);

        if (error) {
            setIsLoggingIn(false);
            setError(error);
        }
    }

    return { isLoggingIn, logIn, error };
}