import Option, { Action } from "./Option";
import OptionShadow from "./OptionShadow";
import TitleField from "./TitleField";

export default function TopBar() {
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
                    <Action onClick={() => {}}>
                        Zoom in
                    </Action>
                    <Action onClick={() => {}}>
                        Zoom out
                    </Action>
                    <Action 
                        onClick={() => {}}
                        shortcut="Ctrl+R"
                    >
                        Rotate 90° right
                    </Action>
                    <Action 
                        onClick={() => {}}
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