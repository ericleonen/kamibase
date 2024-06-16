import Kami from "@/origami/Kami";
import { useRender } from "./render";
import { HOVER_RADIUS, KAMI_PIXELS, PADDING } from "@/settings";
import { useAtomValue } from "jotai";
import { toolAtom } from "../page";
import { useEffect, useState } from "react";
import Vertex from "@/origami/Vertex";
import Point from "@/origami/Point";
import Crease, { CreaseType } from "@/origami/Crease";

const kami = Kami.fromString(`
    N 0 0 1 0
    N 0 0 0 1
    N 0 1 1 1
    N 1 0 1 1
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
    const [hoveredCrease, setHoveredCrease] = useState<Crease>();

    const tool = useAtomValue(toolAtom);
    const canvasRef = useRender({ 
        kami, 
        tool, 
        hoveredVertex, 
        selectedVertex,
        mousePoint,
        hoveredCrease
    });

    useEffect(() => {
        setHoveredCrease(undefined);
        setSelectedVertex(undefined);
        setMousePoint(undefined);
        setHoveredCrease(undefined);
    }, [tool]);

    const handleClick = () => {
        if (tool === "E" && hoveredCrease) {
            kami.eraseCrease(hoveredCrease);
            setHoveredCrease(undefined);
        } else if (hoveredVertex) {
            if (selectedVertex) {
                if (hoveredVertex.equals(selectedVertex)) {
                    // Unselect selected Vertex by clicking on it twice
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
            ((e.clientX - rect.left) * scaleX - PADDING) / KAMI_PIXELS,
            ((e.clientY - rect.top) * scaleY - PADDING) / KAMI_PIXELS
        );

        if (tool === "E") {
            let hoveredCreaseFound = false;

            for (let crease of kami.creases.toList(true)) {
                if (mousePoint.distance(crease) * canvas.height < HOVER_RADIUS) {
                    hoveredCreaseFound = true;
                    setHoveredCrease(crease);

                    break;
                }
            }

            if (!hoveredCreaseFound) setHoveredCrease(undefined);
        } else {
            if (selectedVertex) setMousePoint(mousePoint);
            else setMousePoint(undefined);

            let hoveredVertexFound = false;

            for (let vertex of kami.vertexes.toList(true)) {
                if (mousePoint.distance(vertex) * canvas.height < HOVER_RADIUS) {
                    hoveredVertexFound = true;
                    setHoveredVertex(vertex);

                    break;
                }
            }

            if (!hoveredVertexFound) setHoveredVertex(undefined);
        }
    };

    return (
        <div className="flex-grow flex justify-center items-center">
            <canvas
                onClick={handleClick}
                onMouseMove={handleMouseMove}
                ref={canvasRef}
                height={KAMI_PIXELS + 2 * PADDING}
                width={KAMI_PIXELS + 2 * PADDING}
                className="h-[500px] w-[500px]"
            />
        </div>
    )
}