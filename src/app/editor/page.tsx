"use client"

import KamiSection from "./_components/KamiSection";
import LeftSection from "./_components/LeftSection";
import RightSection from "./_components/RightSection";
import TopBar from "./_components/TopBar";

export default function EditorPage() {
    return (
        <div className="h-screen flex flex-col">
            <TopBar />
            <section className="flex flex-grow bg-theme-white">
                <LeftSection />
                <KamiSection />
                <RightSection />
            </section>
        </div>
    )
}