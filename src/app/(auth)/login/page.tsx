"use client"

import { useState } from "react";
import Form from "../components/Form";
import TextField from "../components/TextField";
import SubmitButton from "../components/SubmitButton";
import { useLogin } from "@/auth/session";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const login = useLogin();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        login.attempt(email, password);
    }

    return (
        <div className="h-screen w-screen flex items-center justify-center">
            <Form
                preText="Log in to"
                onSubmit={handleSubmit}
            >
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
                <SubmitButton inProgress={login.inProgress} />
            </Form>
        </div>
    )
}