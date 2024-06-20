"use client"

import { atom } from "jotai";
import KamiSection from "./KamiSection";
import ToolSection, { Tool } from "./ToolSection";
import TopBar from "./TopBar";

export const toolAtom = atom<Tool>("M");

export const zoomAtom = atom<"+" | "-" | undefined>(undefined);
export const rotateAtom = atom<"L" | "R" | undefined>(undefined);

export const sizeAtom = atom<number>(500);

export default function EditorPage() {
    return (
        <div className="h-screen flex flex-col">
            <TopBar />
            <section 
                className="flex-grow bg-theme-white relative overflow-scroll"
            >
                <ToolSection />
                <KamiSection />
            </section>
        </div>
    )
}