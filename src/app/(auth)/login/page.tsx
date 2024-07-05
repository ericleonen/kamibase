"use client"

import { useState } from "react";
import Container from "../components/Container";
import TextField from "../components/TextField";
import SubmitButton from "../components/SubmitButton";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    return (
        <div className="h-screen w-screen flex items-center justify-center">
            <Container
                preText="Log in to"
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
                <SubmitButton />
            </Container>
        </div>
    )
}