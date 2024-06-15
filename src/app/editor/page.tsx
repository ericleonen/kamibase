"use client"

import { atom } from "jotai";
import KamiSection from "./KamiSection";
import ToolSection, { Tool } from "./ToolSection";
import TopBar from "./TopBar";

export const toolAtom = atom<Tool>("M");

export default function EditorPage() {
    return (
        <div className="h-screen flex flex-col">
            <TopBar />
            <section className="flex flex-grow bg-theme-white">
                <ToolSection />
                <KamiSection />
            </section>
        </div>
    )
}