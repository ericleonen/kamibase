import Kami from "@/origami/Kami";
import { useRender } from "./render";

export default function KamiSection() {
    const kami = Kami.fromString(`
        N 0.25 0 0.25 1
        N 0.5 0 0.5 1
        N 0.75 0 0.75 1
        N 0 0.25 1 0.25
        N 0 0.5 1 0.5
        N 0 0.75 1 0.75
    `);

    const kamiRef = useRender({ kami });

    return (
        <div className="flex-grow flex justify-center items-center">
            <canvas
                ref={kamiRef}
                height={1000}
                width={1000}
                className="h-[500px] w-[500px] border-[3px] border-theme-black"
            />
        </div>
    )
}