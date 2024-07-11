"use client"

import { useSetAtom } from "jotai";
import KamiDisplay, { kamiStringAtom } from "./KamiDisplay";
import ToolSection from "./ToolSection";
import TopBar from "./TopBar";
import ProcessManager from "@/origami/ProcessManager";
import { Action, Process } from "@/origami/ProcessManager/types";
import Kami from "@/origami/Kami";
import { useEffect, useMemo } from "react";

export default function EditorPage() {
    const processManager = useMemo(() => new ProcessManager(), []);
    const kami = useMemo(() => Kami.creaseGrid(32), []);
    
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