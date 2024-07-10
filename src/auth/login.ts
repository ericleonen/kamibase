import { auth } from "@/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

async function logInLocally(email: string, password: string) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        return err as Error;
    }
}

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