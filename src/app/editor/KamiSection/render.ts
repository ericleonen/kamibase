import Kami from "@/origami/Kami";
import { HOVER_RADIUS, KAMI_PIXELS } from "@/settings";
import { RefObject, useRef, useEffect } from "react";
import { Tool } from "../ToolSection";
import Vertex from "@/origami/Vertex";
import { CreaseType } from "@/origami/Crease";
import Point from "@/origami/Point";

type RenderData = {
    kami: Kami,
    tool: Tool,
    hoveredVertex?: Vertex
}

/**
 * Returns the ref for a HTMLCanvasElement. Custom hook for re-rendering the Kami Canvas every time
 * the internals of the Kami changes.
 * @param data RenderData
 */
export function useRender(data: RenderData): RefObject<HTMLCanvasElement> {
    const { kami, tool, hoveredVertex } = data;

    const kamiRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = kamiRef.current;
        const context = canvas && canvas.getContext("2d");

        if (context) render(data, canvas, context);
    }, [kami.toString(), tool, hoveredVertex?.key]);

    return kamiRef;
}

/**
 * Re-draws the entire Kami from scratch given the given data.
 * @param data RenderData
 * @param canvas HTMLCanvasElement
 * @param context CanvasRenderingContext2D
 */
export function render(data: RenderData, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    const { kami, tool, hoveredVertex } = data;

    context.clearRect(0, 0, canvas.width, canvas.height);

    kami.creases.toList().forEach(crease => {
        drawLine(crease.type, crease.vertex1, crease.vertex2, context);
    });

    if (hoveredVertex) {
        context.beginPath();
        context.arc(
            hoveredVertex.x * KAMI_PIXELS, 
            hoveredVertex.y * KAMI_PIXELS, 
            HOVER_RADIUS * 0.75, 
            0, 
            2 * Math.PI
        );
        context.fill();
        context.closePath();
    }

    context.closePath();
}

function drawLine(
    type: CreaseType, 
    point1: Point, 
    point2: Point, 
    context: CanvasRenderingContext2D
) {
    context.lineWidth = 2;
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