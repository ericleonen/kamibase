"use client"

import { useAutoLogOut } from "@/auth/logOut";
import TopBar from "./TopBar";

export default function Home() {
    useAutoLogOut();

    return (
        <div className="h-screen flex flex-col bg-theme-white">
            <TopBar />
        </div>
    )
}