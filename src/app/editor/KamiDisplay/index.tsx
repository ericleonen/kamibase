import Kami from "@/origami/Kami"
import { Action } from "@/origami/ProcessManager/types"
import useRender from "./render"

type KamiDisplayProps = {
    kami: Kami,
    process: (action: Action) => void
}

export default function KamiDisplay({ kami, process }: KamiDisplayProps) {
    const canvasRef = useRender({ kami });

    return (
        <canvas
            ref={canvasRef}
            className="h-full w-full"
        />
    )
}