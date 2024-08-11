import { auth } from "@/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Custom hook that provides a login object with progress and error states and an attempt function.
 */
export function useLogin(): {
    inProgress: boolean,
    error?: Error,
    attempt: (email: string, password: string) => void
} {
    const [inProgress, setInProgress] = useState(false);
    const [error, setError] = useState<Error>();
    const router = useRouter();

    const attempt = async (email: string, password: string) => {
        setInProgress(true);

        try {
            const { user } = await signInWithEmailAndPassword(auth, email, password);
            const idToken = await user.getIdToken();
            const response = await fetch("/api/login", {
                method: "POST",
                headers: new Headers({
                    "Authorization": `Bearer ${idToken}`
                })
            });
            const success = (await response.json()).succeeded;

            if (success) {
                router.replace("/");
                router.refresh();
                setInProgress(false);
            } else {
                throw Error("Something went wrong");
            }
        } catch (err) {
            setInProgress(false);
            setError(err as Error);
        }
    }

    return { inProgress, error, attempt };
}

export function useLogout(): {
    inProgress: boolean,
    error?: Error,
    attempt: () => void
} {
    const router = useRouter();

    const [inProgress, setInProgress] = useState(false);
    const [error, setError] = useState<Error>();

    const attempt = async () => {
        setInProgress(true);
        
        try {
            await fetch("/api/logout", {
                method: "POST"
            });
            router.refresh();

            setInProgress(false);
        } catch (err) {
            setInProgress(false);
            setError(err as Error);
        }
    }

    return { inProgress, error, attempt };
}