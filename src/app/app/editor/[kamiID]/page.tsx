"use client"

import { useAtomValue } from "jotai";
import KamiDisplay from "../KamiDisplay";
import ToolSection from "../ToolSection";
import TopBar from "../TopBar";
import ProcessManager from "@/origami/ProcessManager";
import { Action, Process } from "@/origami/ProcessManager/types";
import Kami from "@/origami/Kami";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useLoadKami } from "@/db/kami/read";
import { kamiAtom, useSetKamiString } from "@/atoms/kami";
import { KamiDisplayError, KamiDisplayLoader } from "../KamiDisplay/fallback";

/**
 * Custom hook that reads and returns the requested kamiID from the URL path.
 */
function usePathKamiID(): string {
    const path = usePathname();
    const kamiID = path.split("/")[3];

    return kamiID;
}

export default function EditorPage() {
    const kamiID = usePathKamiID();
    const loadKamiError = useLoadKami(kamiID);

    const kami = useAtomValue(kamiAtom);
    const setKamiString = useSetKamiString();

    const processManager = useMemo(() => new ProcessManager(), [kami]);
    const kamiObject = useMemo(() => Kami.fromString(kami.kamiString), [kami]);

    const process = (action: Action) => {
        let processTaken: Process | undefined;

        if (action.name === "crease") {
            const { type, x1, y1, x2, y2 } = action.params;

            processTaken = kamiObject.crease(type, x1, y1, x2, y2);
            setKamiString(kamiObject.toString());
        } else if (action.name === "erase") {
            const { x1, y1, x2, y2 } = action.params;

            processTaken = [kamiObject.erase(x1, y1, x2, y2)];
            setKamiString(kamiObject.toString());
        } else if (action.name === "rotate") {
            const { direction } = action.params;

            processTaken = [kamiObject.rotate(direction)];
            setKamiString(kamiObject.toString());
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
                {
                    kami.loadStatus === "succeeded" ? <KamiDisplay {...{kamiObject, process}} /> :
                    ["idle", "loading"].includes(kami.loadStatus) ? <KamiDisplayLoader /> :
                    <KamiDisplayError error={loadKamiError} />
                }
            </section>
        </div>
    )
}