import OptionMenu, { Option } from "./OptionMenu";
import OptionShadow from "./OptionShadow";
import TitleField from "./TitleField";
import { Action } from "@/origami/ProcessManager";

type TopBarProps = {
    process: (action: Action) => void
}

export default function TopBar({ process }: TopBarProps) {
    const handleRotate = (direction: "left" | "right") => {
        process({
            name: "rotate",
            params: { direction }
        });
    }

    const handleZoom = (direction: "in" | "out") => {
        process({
            name: "zoom",
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
                        onClick={() => {}}
                        shortcut="Ctrl+Z"
                    >
                        Undo
                    </Option>
                    <Option
                        onClick={() => {}}
                        shortcut="Ctrl+Shift+Z"
                    >
                        Redo
                    </Option>
                </OptionMenu>
                <OptionMenu name="View">
                    <Option onClick={() => handleZoom("in")}>
                        Zoom in
                    </Option>
                    <Option onClick={() => handleZoom("out")}>
                        Zoom out
                    </Option>
                    <Option 
                        onClick={() => handleRotate("right")}
                        shortcut="Ctrl+R"
                    >
                        Rotate 90° right
                    </Option>
                    <Option 
                        onClick={() => handleRotate("left")}
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