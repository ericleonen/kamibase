"use client"

import { atom, useAtom, useSetAtom } from "jotai";
import KamiDisplay from "./KamiDisplay";
import ToolSection, { Tool } from "./ToolSection";
import TopBar from "./TopBar";
import ProcessManager, { Action } from "../../origami/ProcessManager";
import { KAMI_DIMS_RANGE, KAMI_ZOOM_DELTA } from "@/settings";
import Kami from "@/origami/Kami";

export const processManager = new ProcessManager();

export const toolAtom = atom<Tool>("M");

export const kamiDimsAtom = atom<number>(500);

export const kamiStringAtom = atom<string>("");

export default function EditorPage() {
    const kami = Kami.fromString(`
        N 0.25 0 0.25 1
        N 0.5 0 0.5 1
        N 0.75 0 0.75 1
        N 0 0.25 1 0.25
        N 0 0.5 1 0.5
        N 0 0.75 1 0.75
    `);

    const [kamiDims, setKamiDims] = useAtom(kamiDimsAtom);
    const setKamiString = useSetAtom(kamiStringAtom);

    const process = (action: Action) => {
        if (action.name === "crease") {
            console.log("HI")

            const { type, x1, y1, x2, y2 } = action.params;
            processManager.push(kami.crease(type, x1, y1, x2, y2));
            setKamiString(kami.toString());
        } else if (action.name === "erase") {
            const { x1, y1, x2, y2 } = action.params;

            processManager.push(kami.erase(x1, y1, x2, y2));
            setKamiString(kami.toString());
        } else if (action.name === "rotate") {
            const { direction } = action.params;

            processManager.push(kami.rotate(direction));
            setKamiString(kami.toString());
        } else if (action.name === "zoom") {
            const { direction } = action.params;

            if (direction === "in" && kamiDims + KAMI_ZOOM_DELTA <= KAMI_DIMS_RANGE[1]) {
                processManager.push(action);
                setKamiDims(origDims => origDims + KAMI_ZOOM_DELTA);
            } else if (direction === "out" && kamiDims - KAMI_ZOOM_DELTA >= KAMI_DIMS_RANGE[0]) {
                processManager.push(action);
                setKamiDims(origDims => origDims - KAMI_ZOOM_DELTA);
            }
        }
    }

    return (
        <div className="h-screen flex flex-col">
            <TopBar {...{process}}/>
            <section 
                className="flex-grow bg-theme-white relative overflow-scroll"
            >
                <ToolSection />
                <KamiDisplay {...{kami, process}} />
            </section>
        </div>
    )
}