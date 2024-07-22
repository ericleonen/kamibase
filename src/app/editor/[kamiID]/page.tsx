"use client"

import { useAtomValue } from "jotai";
import KamiDisplay from "../KamiDisplay";
import ToolSection from "../ToolSection";
import TopBar from "../TopBar";
import ProcessManager from "@/origami/ProcessManager";
import { Action, Process } from "@/origami/ProcessManager/types";
import Kami from "@/origami/Kami";
import { useEffect, useState } from "react";
import { useLoadKami, usePathKamiID } from "@/db/kami/read";
import { kamiAtom, useSetKami, } from "@/atoms/kami";
import { KamiDisplayError, KamiDisplayLoader } from "../KamiDisplay/fallback";
import { useUnsavedChangesPopup } from "@/utils/window";

export default function EditorPage() {
    const kamiID = usePathKamiID();
    useLoadKami(kamiID);

    const kami = useAtomValue(kamiAtom);
    const setKami = useSetKami();

    const [processManager, setProcessManager] = useState<ProcessManager>();
    const [kamiObject, setKamiObject] = useState<Kami>();

    useEffect(() => {
        if (kami.loadStatus === "succeeded") {
            setProcessManager(new ProcessManager());
            setKamiObject(Kami.fromString(kami.kamiString));
        }
    }, [kami.loadStatus]);

    const process = (action: Action) => {
        if (!kamiObject || !processManager) return;

        setKami({ saveStatus: "unsaved" });

        let processTaken: Process | undefined;

        if (action.name === "crease") {
            const { type, x1, y1, x2, y2 } = action.params;

            processTaken = kamiObject.crease(type, x1, y1, x2, y2);
        } else if (action.name === "erase") {
            const { x1, y1, x2, y2 } = action.params;

            processTaken = [kamiObject.erase(x1, y1, x2, y2)];
        } else if (action.name === "rotate") {
            const { direction } = action.params;

            processTaken = [kamiObject.rotate(direction)];
        }

        if (!processTaken) return;

        setKami({ kamiString: kamiObject.toString() });

        if (!action.type) {
            processManager.push(processTaken);
            processManager.clearUndoHistory();
        }
    }

    useUnsavedChangesPopup(kami.saveStatus !== "saved");

    return (
        <div className="h-screen flex flex-col bg-theme-white">
            <TopBar {...{process, processManager}}/>
            <section 
                className="flex-grow relative overflow-scroll"
            >
                <ToolSection />
                {
                    kami.loadStatus === "succeeded" && kamiObject ? <KamiDisplay {...{kamiObject, process}} /> :
                    ["idle", "loading"].includes(kami.loadStatus) ? <KamiDisplayLoader /> :
                    <KamiDisplayError />
                }
            </section>
        </div>
    )
}