import { useRef } from "react"

export default function KamiSection() {
    const kamiRef = useRef<HTMLCanvasElement>(null);

    return (
        <div className="flex-grow flex justify-center items-center">
            <canvas
                ref={kamiRef}
                className="h-[500px] w-[500px] border-4 border-theme-black"
            />
        </div>
    )
}