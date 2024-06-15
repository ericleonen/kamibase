import Kami from "@/origami/Kami";
import { useRender } from "./render";
import { HOVER_RADIUS, KAMI_PIXELS } from "@/settings";
import { useAtomValue } from "jotai";
import { toolAtom } from "../page";
import { useState } from "react";
import Vertex from "@/origami/Vertex";
import Point from "@/origami/Point";
import { CreaseType } from "@/origami/Crease";

const kami = Kami.fromString(`
    N 0.25 0 0.25 1
    N 0.5 0 0.5 1
    N 0.75 0 0.75 1
    N 0 0.25 1 0.25
    N 0 0.5 1 0.5
    N 0 0.75 1 0.75
`);

export default function KamiSection() {
    const [hoveredVertex, setHoveredVertex] = useState<Vertex>();
    const [selectedVertex, setSelectedVertex] = useState<Vertex>();
    const [mousePoint, setMousePoint] = useState<Point>();

    const tool = useAtomValue(toolAtom);
    const canvasRef = useRender({ 
        kami, 
        tool, 
        hoveredVertex, 
        selectedVertex,
        mousePoint 
    });

    const handleClick = () => {
        if (tool === "E") {
            
        } else if (hoveredVertex) {
            if (selectedVertex) {
                if (hoveredVertex.equals(selectedVertex)) {
                    // Unselect selected Vertex by clicking on it twice
                    return;
                } else {
                    // Crease Kami by clicking two different Vertexes
                    kami.crease(
                        tool as CreaseType, 
                        hoveredVertex.x, hoveredVertex.y, 
                        selectedVertex.x, selectedVertex.y
                    );
                }

                setSelectedVertex(undefined);
            } else {
                // Select the first Vertex for a Crease
                setSelectedVertex(hoveredVertex);
                setHoveredVertex(undefined);
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;

        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const mousePoint = new Point(
            (e.clientX - rect.left) * scaleX / KAMI_PIXELS,
            (e.clientY - rect.top) * scaleY / KAMI_PIXELS
        );

        if (selectedVertex) setMousePoint(mousePoint);
        else setMousePoint(undefined);

        let hoveredVertexFound = false;

        for (let vertex of kami.vertexes.toList(true)) {
            if (mousePoint.distance(vertex) * KAMI_PIXELS < HOVER_RADIUS) {
                hoveredVertexFound = true;
                setHoveredVertex(vertex);

                break;
            }
        }

        if (!hoveredVertexFound) {
            setHoveredVertex(undefined);
        }
    };

    return (
        <div className="flex-grow flex justify-center items-center">
            <canvas
                onClick={handleClick}
                onMouseMove={handleMouseMove}
                ref={canvasRef}
                height={KAMI_PIXELS}
                width={KAMI_PIXELS}
                className="h-[500px] w-[500px] border-[3px] border-theme-black"
            />
        </div>
    )
}