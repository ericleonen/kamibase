import Kami from "@/origami/Kami";
import { HOVER_RADIUS, KAMI_PIXELS } from "@/settings";
import { RefObject, useRef, useEffect } from "react";
import { Tool } from "../ToolSection";
import Vertex from "@/origami/Vertex";
import Crease, { CreaseType } from "@/origami/Crease";
import Point from "@/origami/Point";

type RenderData = {
    kami: Kami,
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
    const { kami, tool, hoveredVertex, selectedVertex, mousePoint, hoveredCrease } = data;

    const kamiRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = kamiRef.current;
        const context = canvas && canvas.getContext("2d");

        if (context) render(data, canvas, context);
    }, [kami.toString(), tool, hoveredVertex, selectedVertex, mousePoint, hoveredCrease]);

    return kamiRef;
}

/**
 * Re-draws the entire Kami from scratch given the given data.
 * @param data RenderData
 * @param canvas HTMLCanvasElement
 * @param context CanvasRenderingContext2D
 */
export function render(data: RenderData, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    const { kami, tool, hoveredVertex, selectedVertex, mousePoint, hoveredCrease } = data;

    context.clearRect(0, 0, canvas.width, canvas.height);

    kami.creases.toList().forEach(crease => {
        const lineWidth = hoveredCrease && crease.equals(hoveredCrease) ? 4 : 2;
        drawLine(crease.type, crease.vertex1, crease.vertex2, context, lineWidth);
    });

    if (hoveredVertex) drawPoint(hoveredVertex, HOVER_RADIUS * 0.75, context);
    else if (mousePoint) drawPoint(mousePoint, HOVER_RADIUS * 0.5, context);

    if (selectedVertex) drawPoint(selectedVertex, HOVER_RADIUS * 0.5, context);

    const draggedPoint = hoveredVertex || mousePoint;
    if (tool !== "E" && selectedVertex && draggedPoint) {
        drawLine(tool as CreaseType, selectedVertex, draggedPoint, context);
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
    context: CanvasRenderingContext2D,
    lineWidth: number = 2
) {
    context.lineWidth = lineWidth;
    context.strokeStyle = 
        type === "M" ? "red" :
        type === "V" ? "blue" :
        "gray";

    context.beginPath();
    context.moveTo(point1.x * KAMI_PIXELS, point1.y * KAMI_PIXELS);
    context.lineTo(point2.x * KAMI_PIXELS, point2.y * KAMI_PIXELS);
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
    context: CanvasRenderingContext2D
) {
    context.beginPath();
    context.arc(
        point.x * KAMI_PIXELS, 
        point.y * KAMI_PIXELS, 
        radius, 
        0, 
        2 * Math.PI
    );
    context.fill();
    context.closePath();
}