"use client"

import { useState } from "react";
import Container from "../components/Container";
import TextField from "../components/TextField";
import SubmitButton from "../components/SubmitButton";
import { useSignUp } from "@/auth/signUp";
import { useAutoLogIn } from "@/auth/login";

export default function SignUp() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const { isSigningUp, signUp, error } = useSignUp();

    const handleSubmit = () => {
        signUp(name, email, password);
    }

    useAutoLogIn();

    return (
        <div className="h-screen flex justify-center items-center bg-theme-white">
            <Container preText="Sign up for">
                <TextField 
                    text={name}
                    setText={setName}
                    placeholder="Name"
                />
                <TextField 
                    text={email}
                    setText={setEmail}
                    placeholder="Email"
                />
                <TextField 
                    text={password}
                    setText={setPassword}
                    placeholder="Password"
                    sensitive
                />
                <SubmitButton onClick={handleSubmit}/>
            </Container>
        </div>
    );
}