import { useSetAtom } from "jotai";
import Option, { Action } from "./Option";
import OptionShadow from "./OptionShadow";
import TitleField from "./TitleField";
import { rotateAtom, sizeAtom, zoomAtom } from "../page";
import { KAMI_ZOOM_DELTA } from "@/settings";

export default function TopBar() {
    const setRotate = useSetAtom(rotateAtom);
    const setSize = useSetAtom(sizeAtom);
    const setZoom = useSetAtom(zoomAtom);

    const handleZoom = (z: "+" | "-") => {
        setZoom(z);

        if (z === "+") {
            setSize(origSize => origSize + KAMI_ZOOM_DELTA);
        } else {
            setSize(origSize => origSize - KAMI_ZOOM_DELTA);
        }
    };

    return (
        <>
            <section className="flex relative h-16 bg-theme-black">
                <Option name="File">
                    <Action 
                        onClick={() => {}}
                        shortcut="Ctrl+N"
                    >
                        New Kami file
                    </Action>
                    <Action 
                        onClick={() => {}}
                        shortcut="Ctrl+O"
                    >
                        Open Kami file
                    </Action>
                    <Action
                        onClick={() => {}}
                        shortcut="Ctrl+S"
                    >
                        Save
                    </Action>
                    <Action onClick={() => {}}>Delete</Action>
                </Option>
                <Option name="Edit">
                    <Action
                        onClick={() => {}}
                        shortcut="Ctrl+Z"
                    >
                        Undo
                    </Action>
                    <Action
                        onClick={() => {}}
                        shortcut="Ctrl+Shift+Z"
                    >
                        Redo
                    </Action>
                </Option>
                <Option name="View">
                    <Action onClick={() => handleZoom("+")}>
                        Zoom in
                    </Action>
                    <Action onClick={() => handleZoom("-")}>
                        Zoom out
                    </Action>
                    <Action 
                        onClick={() => setRotate("R")}
                        shortcut="Ctrl+R"
                    >
                        Rotate 90° right
                    </Action>
                    <Action 
                        onClick={() => setRotate("L")}
                        shortcut="Ctrl+L"
                    >
                        Rotate 90° left
                    </Action>
                </Option>
                <TitleField />
            </section>
            <OptionShadow />
        </>
    )
}