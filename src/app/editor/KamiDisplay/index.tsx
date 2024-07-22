import Kami from "@/origami/Kami"
import { Action } from "@/origami/ProcessManager/types"
import { useRender } from "@/origami/render"
import { useEffect } from "react"

type KamiDisplayProps = {
    kamiObject: Kami,
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

export default function KamiDisplay({ kamiObject, process }: KamiDisplayProps) {
    const [canvasRef, {
        handleWheel,
        handleClick,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseOut
    }] = useRender(kamiObject, process);

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