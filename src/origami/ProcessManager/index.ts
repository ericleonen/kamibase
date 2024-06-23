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
export type Process = Action[];

/**
 * The processing unit of Processes taken on a Kami object. Holds a history Processes.
 */
export default class ProcessManager {
    private history: Process[];
    private undoHistory: Process[];

    constructor() {
        this.history = [];
        this.undoHistory = [];
    }

    public push(process: Process) {
        this.history.push(process);
    }

    public undo(): Process | undefined {
        let process = this.history.pop();

        if (!process) return;

        this.undoHistory.push(process);

        return process.toReversed()
            .map(action => ({...this.reverseAction(action), type: "undo"}));
    }

    public redo(): Process | undefined {
        let process = this.undoHistory.pop();

        if (!process) return;
        
        this.history.push(process);

        return process.map(action => ({...action, type: "redo"}))
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