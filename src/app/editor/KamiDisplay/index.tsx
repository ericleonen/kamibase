import Kami from "@/origami/Kami"
import { Action } from "@/origami/ProcessManager/types"
import useRender from "./render"
import React, { useEffect, useState } from "react"
import { useAtom, useSetAtom } from "jotai"
import { kamiDimsAtom, originAtom } from "../page"
import Point from "@/origami/Point"
import { KAMI_SCROLL_FACTOR, KAMI_ZOOM_FACTOR, PIXEL_DENSITY } from "@/settings"
import Vertex from "@/origami/Vertex"

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