import { CreaseType } from "../Crease";

export type CreaseAction = { 
    name: "crease", 
    params: {
        type: CreaseType, 
        x1: number, 
        y1: number, 
        x2: number, 
        y2: number
    }
};
export type EraseAction = { 
    name: "erase",
    params: {
        x1: number, 
        y1: number, 
        x2: number, 
        y2: number
    }
};
export type RotateAction = { 
    name: "rotate", 
    params: { direction: "left" | "right" } 
};
export type ZoomAction = { 
    name: "zoom", 
    params: { direction: "in" | "out" }
};

export type Action = CreaseAction | EraseAction | RotateAction | ZoomAction;

/**
 * A list of independent Actions.
 */
export type Process = Action[];

/**
 * The processing unit of Processes taken on a Kami object. Holds a history Processes.
 */
export default class ProcessManager {
    private history: (Process | Action)[];

    constructor() {
        this.history = [];
    }

    public push(process: Process | Action) {
        this.history.push(process);

        console.log(this.history);
    }
}