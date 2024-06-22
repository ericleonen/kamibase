import Kami from "@/origami/Kami";
import { useRender } from "./render";
import { HOVER_RADIUS, KAMI_PIXELS, PADDING } from "@/settings";
import { useAtomValue } from "jotai";
import { kamiDimsAtom, kamiStringAtom, toolAtom } from "../page";
import { useEffect, useState } from "react";
import Vertex from "@/origami/Vertex";
import Point from "@/origami/Point";
import Crease, { CreaseType } from "@/origami/Crease";
import { Action } from "@/origami/ProcessManager";

type KamiDisplayProps = {
    kami: Kami,
    process: (action: Action) => void
}

export default function KamiDisplay({ kami, process }: KamiDisplayProps) {
    const kamiString = useAtomValue(kamiStringAtom);

    const [hoveredVertex, setHoveredVertex] = useState<Vertex>();
    const [selectedVertex, setSelectedVertex] = useState<Vertex>();
    const [mousePoint, setMousePoint] = useState<Point>();
    const [hoveredCrease, setHoveredCrease] = useState<Crease>();
    
    const kamiDims = useAtomValue(kamiDimsAtom);

    const tool = useAtomValue(toolAtom);
    const canvasRef = useRender({ 
        kami,
        kamiString, 
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
            process(hoveredCrease.toAction("erase"));
            setHoveredCrease(undefined);
        } else if (hoveredVertex) {
            if (selectedVertex) {
                if (hoveredVertex.equals(selectedVertex)) {
                    // Unselect selected Vertex by clicking on it twice
                } else {
                    // Crease Kami by clicking two different Vertexes
                    process({
                        name: "crease",
                        params: {
                            type: tool as CreaseType,
                            x1: hoveredVertex.x,
                            y1: hoveredVertex.y,
                            x2: selectedVertex.x,
                            y2: selectedVertex.y
                        }
                    });
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
                if (crease.type === "B") continue;

                if (crease.distanceToPoint(mousePoint) * canvas.height < HOVER_RADIUS) {
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
                if (
                    mousePoint.distance(vertex) * canvas.height < HOVER_RADIUS
                    && !selectedVertex?.onSameBorder(vertex)
                ) {
                    hoveredVertexFound = true;
                    setHoveredVertex(vertex);

                    break;
                }
            }

            if (!hoveredVertexFound) setHoveredVertex(undefined);
        }
    };

    return (
        <canvas
            className="absolute transition-all left-1/2 top-1/2 translate-x-[-50%] translate-y-[-50%]"
            style={{
                cursor: tool === "E" ? "url(eraserToolCursor.png) 2 8, auto" : "auto",
                height: `${kamiDims}px`,
                width: `${kamiDims}px`
            }}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            ref={canvasRef}
            height={KAMI_PIXELS + 2 * PADDING}
            width={KAMI_PIXELS + 2 * PADDING}
        />
    )
}