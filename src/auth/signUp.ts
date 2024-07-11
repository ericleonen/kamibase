import { initializeUser } from "@/db/user/create";
import { auth } from "@/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";

async function signUpLocally(name: string, email: string, password: string) {
    try {
       // TODO: Add guards for name, email, and password fields
       
       const res = await createUserWithEmailAndPassword(auth, email, password);
       const user = res.user;

       return await initializeUser(name, user.uid, email);
    } catch (err) {
        return err as Error;
    }
}

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