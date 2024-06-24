import ProcessManager from ".";
import Crease from "../Crease";
import { CreaseAction, Process } from "./types";

test(`undo() undoes the last Process, 
      redo() redoes Processes, 
      and clearUndoHistory() clears the undo history`, () => {
    const processManager = new ProcessManager();

    const creaseProcess: Process = [
        Crease.fromString("M 0 0 1 1").toAction("crease"), 
        Crease.fromString("V 0.75 0.25 1 0").toAction("crease")
    ];
    const eraseProcess: Process = [{...creaseProcess[0], name: "erase"} as CreaseAction];
    const rotateProcess: Process = [{
        name: "rotate",
        params: {
            direction: 1
        }
    }];
    const zoomProcess: Process = [{
        name: "zoom",
        params: {
            direction: -1
        }
    }];

    processManager.push(creaseProcess);
    processManager.push(eraseProcess);
    processManager.push(rotateProcess);
    processManager.push(zoomProcess);

    // undo zoom
    expect(processManager.undo()).toEqual([{
        ...zoomProcess[0], 
        params: { direction: 1 }, 
        type: "undo"
    }]);
    // undo rotate
    expect(processManager.undo()).toEqual([{
        ...rotateProcess[0], 
        params: { direction: -1 },
        type: "undo"
    }]);
    // undo erase
    expect(processManager.undo()).toEqual([{
        name: "crease",
        params: {
            type: "M",
            x1: 0,
            y1: 0,
            x2: 1,
            y2: 1
        },
        type: "undo"
    }]);
    // undo creases
    expect(processManager.undo()).toEqual([{
        name: "erase",
        params: {
            type: "V",
            x1: 0.75,
            y1: 0.25,
            x2: 1,
            y2: 0
        },
        type: "undo"
    }, {
        name: "erase",
        params: {
            type: "M",
            x1: 0,
            y1: 0,
            x2: 1,
            y2: 1
        },
        type: "undo"
    }]);
    expect(processManager.undo()).toBeFalsy();
    // redo creases
    expect(processManager.redo()).toEqual([{
        ...creaseProcess[0],
        type: "redo"
    }, {
        ...creaseProcess[1],
        type: "redo"
    }]);
    // clear undo history
    processManager.clearUndoHistory()
    expect(processManager.redo()).toBeFalsy();
});