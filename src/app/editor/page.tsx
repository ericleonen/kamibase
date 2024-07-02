"use client"

import { atom, useAtom, useSetAtom } from "jotai";
import KamiDisplay from "./KamiDisplay";
import ToolSection, { Tool } from "./ToolSection";
import TopBar from "./TopBar";
import ProcessManager from "@/origami/ProcessManager";
import { Action, Process } from "@/origami/ProcessManager/types";
import { DEFAULT_KAMI_DIMS } from "@/settings";
import Kami from "@/origami/Kami";
import { useEffect, useMemo } from "react";
import Point from "@/origami/Point";

export const toolAtom = atom<Tool>("M");
export const kamiDimsAtom = atom<number>(DEFAULT_KAMI_DIMS);
export const kamiStringAtom = atom<string>("");
export const originAtom = atom<Point | undefined>(undefined);

export default function EditorPage() {
    const processManager = useMemo(() => new ProcessManager(), []);
    const kami = useMemo(() => Kami.creaseGrid(16), []);
    
    const setKamiString = useSetAtom(kamiStringAtom);

    useEffect(() => {
        setKamiString(kami.toString());
    }, [kami]);

    const process = (action: Action) => {
        let processTaken: Process | undefined;

        if (action.name === "crease") {
            const { type, x1, y1, x2, y2 } = action.params;

            processTaken = kami.crease(type, x1, y1, x2, y2);
            setKamiString(kami.toString());
        } else if (action.name === "erase") {
            const { x1, y1, x2, y2 } = action.params;

            processTaken = [kami.erase(x1, y1, x2, y2)];
            setKamiString(kami.toString());
        } else if (action.name === "rotate") {
            const { direction } = action.params;

            processTaken = [kami.rotate(direction)];
            setKamiString(kami.toString());
        }

        if (!processTaken) return;
        else if (!action.type) {
            processManager.push(processTaken);
            processManager.clearUndoHistory();
        }
    }

    return (
        <div className="h-screen flex flex-col bg-theme-white">
            <TopBar {...{process, processManager}}/>
            <section 
                className="flex-grow relative overflow-scroll"
            >
                <ToolSection />
                <KamiDisplay {...{kami, process}} />
            </section>
        </div>
    )
}