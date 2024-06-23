import { Process, Action, DisplayAction } from "./types";

/**
 * The processing unit of Processes taken on a Kami object. Holds a history Processes.
 */
export default class ProcessManager {
    private history: Process[];
    private undoHistory: Process[];

    /**
     * Initializes a ProcessManager object with a clear history.
     */
    constructor() {
        this.history = [];
        this.undoHistory = [];
    }

    /**
     * Pushes a Process onto the history.
     */
    public push(process: Process) {
        this.history.push(process);
    }

    /**
     * Removes the latest Process in the history and returns its reverse. If the history is empty,
     * returns undefined.
     */
    public undo(): Process | undefined {
        let process = this.history.pop();

        if (!process) return;

        this.undoHistory.push(process);

        return process.toReversed()
            .map(action => ({...this.reverseAction(action), type: "undo"}));
    }

    /**
     * Removes the latest Process in the undo history and returns it. If the undo history is
     * empty, returns undefined.
     */
    public redo(): Process | undefined {
        let process = this.undoHistory.pop();

        if (!process) return;
        
        this.history.push(process);

        return process.map(action => ({...action, type: "redo"}))
    }

    /**
     * Returns the reversed version of an action.
     */
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

    /**
     * Clears the undo history.
     */
    public clearUndoHistory() {
        this.undoHistory = [];
    }
}