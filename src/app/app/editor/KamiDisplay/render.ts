import Crease, { CreaseType } from "@/origami/Crease";
import Kami from "@/origami/Kami";
import Point from "@/origami/Point";
import { CREASE_WIDTH, HOVERED_VERTEX_RADIUS, HOVER_CREASE_WIDTH, HOVER_RADIUS, KAMI_BORDER_WIDTH, KAMI_SCROLL_FACTOR, KAMI_ZOOM_FACTOR, MIN_KAMI_DIMS, PIXEL_DENSITY, SELECTED_VERTEX_RADIUS } from "@/settings";
import { useAtom, useAtomValue } from "jotai";
import { useRef, useEffect, RefObject, useState } from "react";
import { Action } from "@/origami/ProcessManager/types";
import Vertex from "@/origami/Vertex";
import { Tool, toolAtom } from "../ToolSection";
import { kamiStringAtom, originAtom, kamiDimsAtom } from ".";

// Load in theme colors if window is available.
let rootStyle: CSSStyleDeclaration;

try {
    rootStyle = window.getComputedStyle(document.body);
} catch (err) {
    
}

type RenderAPI = [
    RefObject<HTMLCanvasElement>,
    {
        handleWheel: (e: React.WheelEvent) => void,
        handleClick: () => void,
        handleMouseDown: () => void,
        handleMouseMove: (e: React.MouseEvent) => void,
        handleMouseUp: () => void,
        handleMouseOut: () => void
    }
];

/**
 * Custom hook that does all the work of handling KamiDisplay interactivity.
 */
export default function useRender(kami: Kami, process: (action: Action) => void): RenderAPI {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const tool = useAtomValue(toolAtom);
    const kamiString = useAtomValue(kamiStringAtom);
    const [origin, setOrigin] = useAtom(originAtom);
    const [kamiDims, setKamiDims] = useAtom(kamiDimsAtom);

    const [hoveredVertex, setHoveredVertex] = useState<Vertex | undefined>(undefined);
    const [selectedVertex, setSelectedVertex] = useState<Vertex | undefined>(undefined);
    const [hoveredCrease, setHoveredCrease] = useState<Crease | undefined>(undefined);
    const [kamiCursor, setKamiCursor] = useState<Point | undefined>(undefined);

    const [dragging, setDragging] = useState(false);

    // initialize canvas and resize as necessary
    useEffect(() => {
        const canvas = canvasRef.current;

        const initializeCanvas = () => {
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
    
                canvas.width = rect.width * PIXEL_DENSITY;
                canvas.height = rect.height * PIXEL_DENSITY;
    
                setOrigin(origOrigin => {
                    if (!origOrigin) {
                        return new Point(
                            canvas.width / 2 - kamiDims / 2 * PIXEL_DENSITY,
                            canvas.height / 2 - kamiDims / 2 * PIXEL_DENSITY
                        );
                    } else {
                        return new Point(
                            origOrigin.x,
                            origOrigin.y
                        );
                    }
                });
            }
        };

        initializeCanvas();

        window.addEventListener("resize", initializeCanvas);
        
        return () => window.removeEventListener("resize", initializeCanvas);
    }, []);

    // draw kami on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas && canvas.getContext("2d");

        if (context && origin) {
            render(canvas, context, {
                kami,
                tool,
                hoveredVertex,
                selectedVertex,
                hoveredCrease,
                kamiCursor,
                origin,
                kamiDims
            });
        }
    }, [
        kamiString, 
        tool, 
        hoveredVertex, 
        selectedVertex, 
        hoveredCrease, 
        kamiCursor, 
        origin, 
        kamiDims
    ]);

    // reset rendering state when tool changes
    useEffect(() => {
        setHoveredVertex(undefined);
        setSelectedVertex(undefined);
        setHoveredCrease(undefined);
        setKamiCursor(undefined);
    }, []);

    const handleWheel = (e: React.WheelEvent) => {  
        const canvas = canvasRef.current;      
        const { deltaX, deltaY } = e;

        if (e.ctrlKey && canvas) {
            // make the Kami larger/smaller with a Ctrl+Scroll or pinching gesture on the mousepad
            const deltaKamiDims = -deltaY;

            if (kamiDims + deltaKamiDims < MIN_KAMI_DIMS && deltaKamiDims < 0) return;

            const rect = canvas.getBoundingClientRect();

            setKamiDims(origKamiDims => 
                Math.max(origKamiDims + deltaKamiDims * KAMI_ZOOM_FACTOR, MIN_KAMI_DIMS)
            );
            setOrigin(origOrigin => {
                if (!origOrigin) return origOrigin;

                const percentDeltaKamiDims = 
                    (kamiDims + deltaKamiDims * KAMI_ZOOM_FACTOR) / kamiDims;
                const cursorX = (e.clientX - rect.left) * PIXEL_DENSITY - origOrigin.x;
                const cursorY = (e.clientY - rect.top) * PIXEL_DENSITY - origOrigin.y;

                return new Point(
                    origOrigin.x - (cursorX * percentDeltaKamiDims - cursorX),
                    origOrigin.y - (cursorY * percentDeltaKamiDims - cursorY)
                );
            });
        } else {
            // move the Kami horizontally or vertically by scrolling
            setOrigin(origOrigin => {
                return origOrigin && 
                    new Point(
                        origOrigin.x - deltaX * PIXEL_DENSITY / KAMI_SCROLL_FACTOR, 
                        origOrigin.y - deltaY * PIXEL_DENSITY / KAMI_SCROLL_FACTOR
                    );
            });
        }
    };

    const handleClick = () => {
        if (tool === "E" && hoveredCrease) {
            // erase a Crease by clicking it with the eraser tool
            process(hoveredCrease.toAction("erase"));
            setHoveredCrease(undefined);
        } else if (hoveredVertex) {
            if (selectedVertex) {
                // unselect a selected Vertex by clicking it again
                if (hoveredVertex.equals(selectedVertex)) {
                    setSelectedVertex(undefined);
                } else {
                    // crease Kami by clicking two different Vertexes
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

                    setSelectedVertex(undefined);
                }

                setKamiCursor(undefined);
            } else {
                // select a Vertex by clicking it
                setSelectedVertex(hoveredVertex);
                setHoveredVertex(undefined);
            }
        }
    };

    const handleMouseDown = () => {
        // start dragging the Kami by pressing the mouse down
        setDragging(true);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragging) {
            // drag the Kami by moving the down mouse around
            setOrigin(origOrigin => {
                return origOrigin && 
                    new Point(
                        origOrigin.x + e.movementX * PIXEL_DENSITY, 
                        origOrigin.y + e.movementY * PIXEL_DENSITY
                    );
            });
        } else if (origin) {
            const canvas = canvasRef.current;

            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();

            const kamiCursor = new Point(
                ((e.clientX - rect.left) * PIXEL_DENSITY - origin.x) / kamiDims / PIXEL_DENSITY,
                ((e.clientY - rect.top) * PIXEL_DENSITY - origin.y) / kamiDims / PIXEL_DENSITY
            );

            if (selectedVertex) {
                // simulate a Crease by moving around the cursor after selecting a Vertex
                setKamiCursor(kamiCursor);
            }

            if (tool === "E") {
                // threaten to delete a Crease by hovering it with the eraser tool
                let foundHoveredCrease = false;

                for (let crease of kami.creases.toList(true)) {
                    if (crease.type === "B") continue; // you can't hover a bordered crease

                    if (crease.distanceToPoint(kamiCursor) * kamiDims < HOVER_RADIUS) {
                        foundHoveredCrease = true;
                        setHoveredCrease(crease);

                        break;
                    }
                }

                if (!foundHoveredCrease) setHoveredCrease(undefined);
            } else {
                // prepare to select a Vertex by hovering it with a creasing tool
                let foundHoveredVertex = false;

                for (let vertex of kami.vertexes.toList(true)) {
                    if (
                        kamiCursor.distance(vertex) * kamiDims < HOVER_RADIUS &&
                        !selectedVertex?.onSameBorder(vertex)
                    ) {
                        if (selectedVertex) setKamiCursor(vertex);

                        foundHoveredVertex = true;
                        setHoveredVertex(vertex);

                        break;
                    }
                }

                if (!foundHoveredVertex) setHoveredVertex(undefined);
            }
        }
    };

    const handleMouseUp = () => {
        // stop dragging the Kami by letting the mouse up
        setDragging(false);
    }

    const handleMouseOut = () => {
        // stop dragging the Kami by moving the cursor outside of the KamiDisplay
        setDragging(false);
    };

    return [canvasRef, {
        handleWheel,
        handleClick,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseOut
    }];
}

type RenderData = {
    kami: Kami,
    tool: Tool,
    origin: Point,
    kamiDims: number,
    hoveredVertex?: Vertex,
    selectedVertex?: Vertex,
    hoveredCrease?: Crease,
    kamiCursor?: Point
};

/**
 * Draws all lines and hovered lines and vertexes onto the canvas.
 */
function render(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, data: RenderData) {
    const {
        kami,
        tool,
        hoveredVertex,
        selectedVertex,
        hoveredCrease,
        kamiCursor,
        origin,
        kamiDims
    } = data;

    // wipe the canvas clear
    context.clearRect(0, 0, canvas.width, canvas.height);

    // draw all creases
    kami.toRenderable().forEach(crease => {
        const hovered = hoveredCrease?.equals(crease);
        const isBorder = crease.type === "B";

        drawLine({
            line: crease,
            lineWidth: 
                hovered ? HOVER_CREASE_WIDTH :
                isBorder ? KAMI_BORDER_WIDTH :
                CREASE_WIDTH,
            origin,
            context,
            kamiDims
        });
    });

    // draw hovered vertex
    if (hoveredVertex) {
        drawPoint({
            point: hoveredVertex,
            radius: HOVERED_VERTEX_RADIUS,
            context,
            origin,
            kamiDims
        });
    }

    // draw selected vertex
    if (selectedVertex) {
        drawPoint({
            point: selectedVertex,
            radius: SELECTED_VERTEX_RADIUS,
            context,
            origin,
            kamiDims
        });

        if (kamiCursor && tool !== "E") {
            // draw simulated crease
            drawPoint({
                point: kamiCursor,
                radius: SELECTED_VERTEX_RADIUS,
                context,
                origin,
                kamiDims
            });
            drawLine({
                line: {
                    vertex1: selectedVertex,
                    vertex2: kamiCursor,
                    type: tool
                },
                lineWidth: CREASE_WIDTH,
                context,
                origin,
                kamiDims
            });
        }
    }
}

type LineParams = {
    line: Crease | {
        vertex1: Point,
        vertex2: Point,
        type: CreaseType
    },
    lineWidth: number,
    origin: Point,
    context: CanvasRenderingContext2D,
    kamiDims: number
};

/**
 * Draws a line of specified width on the canvas.
 */
function drawLine(params: LineParams) {
    const { line, lineWidth, origin, context, kamiDims } = params;

    context.lineWidth = lineWidth;
    context.lineCap = "round";

    const color =
        line.type === "M" ? "red" :
        line.type === "V" ? "blue" :
        line.type === "N" ? "gray" :
        "black";

    context.strokeStyle =
        rootStyle ? rootStyle.getPropertyValue(`--theme-${color}`) : color;

    context.beginPath();
    context.moveTo(
        origin.x + line.vertex1.x * kamiDims * PIXEL_DENSITY,
        origin.y + line.vertex1.y * kamiDims * PIXEL_DENSITY
    );
    context.lineTo(
        origin.x + line.vertex2.x * kamiDims * PIXEL_DENSITY,
        origin.y + line.vertex2.y * kamiDims * PIXEL_DENSITY
    );
    context.stroke();
    context.closePath();
}

type PointParams = {
    point: Point,
    radius: number,
    context: CanvasRenderingContext2D,
    origin: Point,
    kamiDims: number
};

/**
 * Draws a Point with specified radius onto the canvas.
 */
function drawPoint(params: PointParams) {
    const { point, radius, context, origin, kamiDims } = params;

    context.fillStyle =
        rootStyle ? rootStyle.getPropertyValue("--theme-black") : "black";

    context.beginPath();
    context.arc(
        point.x * kamiDims * PIXEL_DENSITY + origin.x,
        point.y * kamiDims * PIXEL_DENSITY + origin.y,
        radius,
        0,
        2 * Math.PI
    );
    context.fill();
    context.closePath();
}