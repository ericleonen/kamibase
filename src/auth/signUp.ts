import { createUser } from "@/db/user/create";
import { auth } from "@/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useState } from "react";

/**
 * Makes a new account for a user with specified name, email, and password. Guards against empty
 * fields.
 */
async function signUpLocally(name: string, email: string, password: string) {
    if (name.length === 0) {
        throw new Error("Name field is empty.");
    } else if (email.length === 0) {
        throw new Error("Email field is empty.");
    } else if (password.length === 0) {
        throw new Error("Password field is empty.");
    }
    
    const res = await createUserWithEmailAndPassword(auth, email, password);
    const user = res.user;

    await updateProfile(user, {
        displayName: name
    });

    await createUser(user.uid, name);
}

/**
 * Custom hook that provides a sign up function and a progress state.
 */
export function useSignUp(): {
    isSigningUp: boolean,
    signUp: (name: string, email: string, password: string) => void
} {
    const [isSigningUp, setIsSigningUp] = useState(false);

    const signUp = async (name: string, email: string, password: string) => {
        setIsSigningUp(true);

        await signUpLocally(name, email, password);

        setIsSigningUp(false);
    }

    return { isSigningUp, signUp };
}