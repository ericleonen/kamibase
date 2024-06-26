"use client"

import { atom, useAtom, useSetAtom } from "jotai";
import KamiDisplay from "./KamiDisplay";
import ToolSection, { Tool } from "./ToolSection";
import TopBar from "./TopBar";
import ProcessManager from "@/origami/ProcessManager";
import { Action, Process } from "@/origami/ProcessManager/types";
import { DEFAULT_KAMI_DIMS, KAMI_DIMS_RANGE, KAMI_ZOOM_DELTA } from "@/settings";
import Kami from "@/origami/Kami";
import { inBetween } from "@/utils/math";
import { useEffect, useMemo } from "react";
import Point from "@/origami/Point";

export const toolAtom = atom<Tool>("M");
export const kamiDimsAtom = atom<number>(DEFAULT_KAMI_DIMS);
export const kamiStringAtom = atom<string>("");
export const originAtom = atom<Point | undefined>(undefined);

export default function EditorPage() {
    const processManager = useMemo(() => new ProcessManager(), []);
    const kami = useMemo(() => Kami.creaseGrid(8), []);

    const [kamiDims, setKamiDims] = useAtom(kamiDimsAtom);
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
        } else if (action.name === "zoom") {
            const { direction } = action.params;

            if (inBetween(
                kamiDims + KAMI_ZOOM_DELTA * direction, 
                KAMI_DIMS_RANGE[0], 
                KAMI_DIMS_RANGE[1]
            )) {
                processTaken = [action];
                setKamiDims(origDims => origDims + KAMI_ZOOM_DELTA * direction)
            }
        }

        if (!processTaken) return;
        else if (!action.type) {
            processManager.push(processTaken);
            processManager.clearUndoHistory();
        }
    }

    return (
        <div className="h-screen flex flex-col">
            <TopBar {...{process, processManager}}/>
            <section 
                className="flex flex-grow bg-theme-white relative overflow-scroll"
            >
                <ToolSection />
                <KamiDisplay {...{kami, process}} />
            </section>
        </div>
    )
}