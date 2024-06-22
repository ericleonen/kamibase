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
    name: "rotate" | "zoom", 
    type?: "undo" | "redo",
    params: { direction: 1 | -1 } 
};

export type Action = CreaseAction | DisplayAction;

/**
 * A list of independent Actions.
 */
export type Process = Action[];

/**
 * The processing unit of Processes taken on a Kami object. Holds a history Processes.
 */
export default class ProcessManager {
    private history: (Process | Action)[];
    private undoHistory: (Process | Action)[];

    constructor() {
        this.history = [];
        this.undoHistory = [];
    }

    public push(process: Process | Action) {
        this.history.push(process);
    }

    public undo(): Process | undefined {
        const process = this.history.pop();

        if (!process) return;

        this.undoHistory.push(process);

        const undoProcess = Array.isArray(process) ? process
            .toReversed()
            .map(action => this.reverseAction(action)) :
            [this.reverseAction(process)]

        return undoProcess.map(action => ({...action, type: "undo"}))
    }

    public redo(): Process | undefined {
        const process = this.undoHistory.pop();
        if (!process) return;
        
        const redoProcess = Array.isArray(process) ? process : [process];

        return redoProcess.map(action => ({...action, type: "redo"}))
    }

    private reverseAction(action: Action): Action {
        if (action.name === "crease") {
            return {...action, name: "erase"};
        } else if (action.name === "erase") {
            return {...action, name: "crease"};
        } else if (["rotate", "zoom"].includes(action.name)) {
            action = action as DisplayAction;

            return {
                ...action,
                params: {
                    direction: (action.params.direction * -1) as (-1 | 1)
                }
            }
        } else {
            throw new Error(`Invalid action: ${action.name}`);
        }
    }

    public clearUndoHistory() {
        this.undoHistory = [];
    }
}