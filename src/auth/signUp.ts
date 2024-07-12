import { initializeUser } from "@/db/user/create";
import { auth } from "@/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";

/**
 * Makes a new account for a user with specified name, email, and password. Guards against empty
 * fields.
 */
async function signUpLocally(name: string, email: string, password: string) {
    try {
        if (name.length === 0) {
            throw new Error("Name field is empty.");
        } else if (email.length === 0) {
            throw new Error("Email field is empty.");
        } else if (password.length === 0) {
            throw new Error("Password field is empty.");
        }
        
        const res = await createUserWithEmailAndPassword(auth, email, password);
        const user = res.user;

        return await initializeUser(name, user.uid, email);
    } catch (err) {
        return err as Error;
    }
}

/**
 * Custom hoom that provides sign up functionality and information: whether or not the sign-up
 * process taking place and the error.
 */
export function useSignUp(): {
    isSigningUp: boolean,
    signUp: (name: string, email: string, password: string) => void,
    error?: Error
} {
    const [isSigningUp, setIsSigningUp] = useState(false);
    const [error, setError] = useState<Error>();

    const signUp = async (name: string, email: string, password: string) => {
        setIsSigningUp(true);

        const error = await signUpLocally(name, email, password);

        if (error) {
            setIsSigningUp(false);
            setError(error);
        }
    }

    return { isSigningUp, signUp, error };
}