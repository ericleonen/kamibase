import Kami from "@/origami/Kami"
import { Action } from "@/origami/ProcessManager/types"
import useRender from "./render"
import Point from "@/origami/Point"
import { DEFAULT_KAMI_DIMS } from "@/settings"
import { atom } from "jotai"
import { useEffect } from "react"

export const kamiDimsAtom = atom<number>(DEFAULT_KAMI_DIMS);
export const kamiStringAtom = atom<string>("");
export const originAtom = atom<Point | undefined>(undefined);

type KamiDisplayProps = {
    kami: Kami,
    process: (action: Action) => void
}

function useDisableZoom() {
    const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
    };

    useEffect(() => {
        window.addEventListener("wheel", handleWheel, { passive: false });

        return () => window.removeEventListener("wheel", handleWheel);
    }, [handleWheel]);
}

export default function KamiDisplay({ kami, process }: KamiDisplayProps) {
    const [canvasRef, {
        handleWheel,
        handleClick,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseOut
    }] = useRender(kami, process);

    useDisableZoom();

    return (
        <canvas
            ref={canvasRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseOut={handleMouseOut}
            className="h-full w-full"
        />
    )
}