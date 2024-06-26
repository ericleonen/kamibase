import Crease, { CreaseType } from "@/origami/Crease";
import Kami from "@/origami/Kami";
import Point from "@/origami/Point";
import { CREASE_WIDTH, HOVER_CREASE_WIDTH, KAMI_BORDER_WIDTH, PIXEL_DENSITY } from "@/settings";
import { useAtom, useAtomValue } from "jotai";
import { useRef, useEffect, RefObject } from "react";
import { kamiDimsAtom, kamiStringAtom, originAtom } from "../page";

let rootStyle: CSSStyleDeclaration;

try {
    rootStyle = window.getComputedStyle(document.body);
} catch (err) {
    
}

type RenderData = {
    kami: Kami,
    hoveredCrease?: Crease,
    origin?: Point,
    kamiDims?: number
};

export default function useRender(data: RenderData): RefObject<HTMLCanvasElement> {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const kamiString = useAtomValue(kamiStringAtom);
    const [origin, setOrigin] = useAtom(originAtom);
    const kamiDims = useAtomValue(kamiDimsAtom);

    const { hoveredCrease } = data;

    // initialize canvas pixel dimensions and origin
    useEffect(() => {
        const canvas = canvasRef.current;

        if (canvas) {
            const rect = canvas.getBoundingClientRect();

            canvas.height = rect.height * PIXEL_DENSITY;
            canvas.width = rect.width * PIXEL_DENSITY;

            const initialOrigin = new Point(
                canvas.width / 2 - kamiDims / 2 * PIXEL_DENSITY,
                canvas.height / 2 - kamiDims / 2 * PIXEL_DENSITY
            );

            setOrigin(initialOrigin);
        }
    }, []);

    // draw kami on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas && canvas.getContext("2d");

        if (context) render(canvas, context, {
            ...data,
            origin,
            kamiDims
        });
    }, [kamiString, origin, kamiDims, hoveredCrease]);

    return canvasRef;
}

function render(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, data: RenderData) {
    const { kami, hoveredCrease, origin, kamiDims } = data;

    if (!origin || !kamiDims) return;

    console.log(origin, kamiDims)

    console.log(canvas.width, canvas.height);

    // wipe the canvas clear
    context.clearRect(0, 0, canvas.height, canvas.width);

    // draw all creases
    kami.toRenderable().forEach(crease => {
        const hovered = hoveredCrease &&  crease.equals(hoveredCrease);
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