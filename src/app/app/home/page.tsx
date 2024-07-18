"use client"

import KamiCards from "./components/KamiCards"
import TopBar from "./components/TopBar"

export default function Home() {
    return (
        <div className="h-screen flex-col bg-theme-white overflow-hidden">
            <TopBar />
            <KamiCards />
        </div>
    )
}