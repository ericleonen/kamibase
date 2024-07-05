"use client"

import { useState } from "react";
import Container from "../components/Container";
import TextField from "../components/TextField";
import SubmitButton from "../components/SubmitButton";

export default function SignUp() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

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
                <SubmitButton />
            </Container>
        </div>
    );
}