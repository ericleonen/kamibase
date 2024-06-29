import OptionMenu, { Option } from "./OptionMenu";
import OptionShadow from "./OptionShadow";
import TitleField from "./TitleField";
import { Action } from "@/origami/ProcessManager/types";
import ProcessManager from "@/origami/ProcessManager";
import { useSetAtom } from "jotai";
import { kamiDimsAtom } from "../page";
import { KAMI_ZOOM_DELTA } from "@/settings";

type TopBarProps = {
    process: (action: Action) => void,
    processManager: ProcessManager
}

export default function TopBar({ process, processManager }: TopBarProps) {
    const setKamiDims = useSetAtom(kamiDimsAtom);

    const handleUndo = () => {
        processManager.undo()?.forEach(process);
    }

    const handleRedo = () => {
        processManager.redo()?.forEach(process);
    }
    
    const handleRotate = (direction: 1 | -1) => {
        process({
            name: "rotate",
            params: { direction }
        });
    }

    return (
        <>
            <section className="flex relative h-16 bg-theme-black">
                <OptionMenu name="File">
                    <Option 
                        onClick={() => {}}
                        shortcut="Ctrl+N"
                    >
                        New Kami file
                    </Option>
                    <Option 
                        onClick={() => {}}
                        shortcut="Ctrl+O"
                    >
                        Open Kami file
                    </Option>
                    <Option
                        onClick={() => {}}
                        shortcut="Ctrl+S"
                    >
                        Save
                    </Option>
                    <Option onClick={() => {}}>Delete</Option>
                </OptionMenu>
                <OptionMenu name="Edit">
                    <Option
                        onClick={handleUndo}
                        shortcut="Ctrl+Z"
                    >
                        Undo
                    </Option>
                    <Option
                        onClick={handleRedo}
                        shortcut="Ctrl+Shift+Z"
                    >
                        Redo
                    </Option>
                </OptionMenu>
                <OptionMenu name="View">
                    <Option 
                        onClick={() => handleRotate(1)}
                        shortcut="Ctrl+R"
                    >
                        Rotate 90° right
                    </Option>
                    <Option 
                        onClick={() => handleRotate(-1)}
                        shortcut="Ctrl+L"
                    >
                        Rotate 90° left
                    </Option>
                </OptionMenu>
                <TitleField />
            </section>
            <OptionShadow />
        </>
    )
}