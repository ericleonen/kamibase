import { CreaseType } from "../Crease";

export type CreaseAction = { 
    name: "crease" | "erase", 
    type?: "undo" | "redo",
    params: {
        type: CreaseType, 
        x1: number, 
        y1: number, 
        x2: number, 
        y2: number
    }
};

export type DisplayAction = { 
    name: "rotate", 
    type?: "undo" | "redo",
    params: { direction: 1 | -1 } 
};

export type Action = CreaseAction | DisplayAction;
export type Process = Action[];