import { 
    CREASE_WIDTH, 
    HOVERED_VERTEX_RADIUS, 
    HOVER_CREASE_WIDTH, 
    KAMI_BORDER_WIDTH,
    PADDING, 
    PIXEL_DENSITY, 
    SELECTED_VERTEX_RADIUS
} from "@/settings";
import { RefObject, useRef, useEffect } from "react";
import { Tool } from "../ToolSection";
import Vertex from "@/origami/Vertex";
import Crease, { CreaseType } from "@/origami/Crease";
import Point from "@/origami/Point";
import Kami from "@/origami/Kami";

let rootStyle: CSSStyleDeclaration;

try {
    rootStyle = window.getComputedStyle(document.body);
} catch (err) {
    
}

type RenderData = {
    kami: Kami
    kamiString: string,
    kamiDims: number,
    tool: Tool,
    hoveredVertex?: Vertex,
    selectedVertex?: Vertex,
    mousePoint?: Point,
    hoveredCrease?: Crease
}

/**
 * Returns the ref for a HTMLCanvasElement. Custom hook for re-rendering the Kami Canvas every time
 * the internals of the Kami changes.
 * @param data RenderData
 */
export function useRender(data: RenderData): RefObject<HTMLCanvasElement> {
    const { 
        kamiString, 
        kamiDims, 
        tool, 
        hoveredVertex, 
        selectedVertex, 
        mousePoint, 
        hoveredCrease 
    } = data;

    const kamiRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = kamiRef.current;
        const context = canvas && canvas.getContext("2d");

        if (context) render(data, canvas, context);
    }, [kamiString, kamiDims, tool, hoveredVertex, selectedVertex, mousePoint, hoveredCrease]);

    return kamiRef;
}

/**
 * Re-draws the entire Kami from scratch given the given data.
 * @param data RenderData
 * @param canvas HTMLCanvasElement
 * @param context CanvasRenderingContext2D
 */
export function render(data: RenderData, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    const { kami, kamiDims, tool, hoveredVertex, selectedVertex, mousePoint, hoveredCrease } = data;

    context.clearRect(0, 0, canvas.width, canvas.height);

    kami.creases.toList().sort((a, b) => a.type === "B" ? 1 : -1).forEach(crease => {
        const lineWidth = 
            crease.type === "B" ? KAMI_BORDER_WIDTH :
            hoveredCrease && crease.equals(hoveredCrease) ? HOVER_CREASE_WIDTH : 
            CREASE_WIDTH;
        drawLine(
            crease.type, 
            crease.vertex1, 
            crease.vertex2,
            kamiDims,
            context, 
            lineWidth
        );
    });

    if (hoveredVertex) drawPoint(hoveredVertex, HOVERED_VERTEX_RADIUS, kamiDims, context);
    else if (mousePoint) drawPoint(mousePoint, HOVERED_VERTEX_RADIUS, kamiDims, context);

    if (selectedVertex) drawPoint(selectedVertex, SELECTED_VERTEX_RADIUS, kamiDims, context);

    const draggedPoint = hoveredVertex || mousePoint;
    if (tool !== "E" && selectedVertex && draggedPoint) {
        drawLine(tool as CreaseType, selectedVertex, draggedPoint, kamiDims, context);
    }
}

/**
 * Draws a line between two points on the context with the given type.
 * @param type 
 * @param point1 
 * @param point2 
 * @param context 
 * @param lineWidth Optional number
 */
function drawLine(
    type: CreaseType, 
    point1: Point, 
    point2: Point, 
    kamiDims: number,
    context: CanvasRenderingContext2D,
    lineWidth: number = 2
) {
    context.lineWidth = lineWidth;
    context.lineCap = "round";

    const strokeColor = 
        type === "M" ? "red" :
        type === "V" ? "blue" :
        type === "N" ? "gray" :
        "black";

    context.strokeStyle = 
        rootStyle ? rootStyle.getPropertyValue(`--theme-${strokeColor}`) : strokeColor;

    context.beginPath();
    context.moveTo(
        (point1.x * kamiDims + PADDING) * PIXEL_DENSITY, 
        (point1.y * kamiDims + PADDING) * PIXEL_DENSITY
    );
    context.lineTo(
        (point2.x * kamiDims + PADDING) * PIXEL_DENSITY, 
        (point2.y * kamiDims + PADDING) * PIXEL_DENSITY
    );
    context.stroke();
    context.closePath();
}

/**
 * Draws a point on the context with given radius.
 * @param point 
 * @param radius 
 * @param context 
 */
function drawPoint(
    point: Point,
    radius: number,
    kamiDims: number,
    context: CanvasRenderingContext2D
) {
    context.fillStyle =
        rootStyle ? rootStyle.getPropertyValue("--theme-black") : "black";

    context.beginPath();
    context.arc(
        (point.x * kamiDims + PADDING) * PIXEL_DENSITY, 
        (point.y * kamiDims + PADDING) * PIXEL_DENSITY, 
        radius, 
        0, 
        2 * Math.PI
    );
    context.fill();
    context.closePath();
}