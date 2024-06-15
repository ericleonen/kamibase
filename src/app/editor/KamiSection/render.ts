import Kami from "@/origami/Kami";
import { KAMI_PIXELS } from "@/settings";
import { RefObject, useRef, useEffect } from "react";

type RenderData = {
    kami: Kami,
}

/**
 * Returns the ref for a HTMLCanvasElement. Custom hook for re-rendering the Kami Canvas every time
 * the internals of the Kami changes.
 * @param data RenderData
 */
export function useRender(data: RenderData): RefObject<HTMLCanvasElement> {
    const { kami } = data;

    const kamiRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = kamiRef.current;
        const context = canvas && canvas.getContext("2d");

        if (context) render(data, canvas, context);
    }, [kami.toString()]);

    return kamiRef;
}

/**
 * Re-draws the entire Kami from scratch given the given data.
 * @param data RenderData
 * @param canvas HTMLCanvasElement
 * @param context CanvasRenderingContext2D
 */
export function render(data: RenderData, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    const { kami } = data;

    context.clearRect(0, 0, canvas.width, canvas.height);

    kami.creases.toList().forEach(crease => {
        const vertex1 = crease.vertex1;
        const vertex2 = crease.vertex2;

        context.lineWidth = 2;
        context.strokeStyle = 
            crease.type === "M" ? "red" :
            crease.type === "V" ? "blue" :
            "gray";

        context.moveTo(vertex1.x * KAMI_PIXELS, vertex1.y * KAMI_PIXELS);
        context.lineTo(vertex2.x * KAMI_PIXELS, vertex2.y * KAMI_PIXELS);
        context.stroke();
        context.closePath();
    });
}