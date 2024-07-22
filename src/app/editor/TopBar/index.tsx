import OptionMenu, { Option } from "./OptionMenu";
import OptionShadow from "./OptionShadow";
import TitleField from "./TitleField";
import { Action } from "@/origami/ProcessManager/types";
import ProcessManager from "@/origami/ProcessManager";
import { useKamiPublicityToggler, useSaveKami } from "@/db/kami/update";
import { usePathKamiID } from "@/db/kami/read";
import { useDeleteKami } from "@/db/kami/delete";
import HomeButton from "./HomeButton";
import { FaEllipsis, FaEyeSlash, FaRegFolder, FaEarthAmericas, FaPlus, FaRotateLeft, FaRotateRight, FaRegTrashCan } from "react-icons/fa6";
import { FaRedo, FaRegSave, FaUndo } from "react-icons/fa";
import { useAtomValue } from "jotai";
import { kamiAtom } from "@/atoms/kami";
import { MdLock } from "react-icons/md";
import Spinner from "@/app/components/Spinner";

type TopBarProps = {
    process: (action: Action) => void,
    processManager?: ProcessManager
}

export default function TopBar({ process, processManager }: TopBarProps) {
    const kami = useAtomValue(kamiAtom);
    const kamiID = usePathKamiID();
    const saveKami = useSaveKami(kamiID);
    const deleteKami = useDeleteKami(kamiID);
    const kamiPublicityToggler = useKamiPublicityToggler(kamiID);
    
    const handleSave = async () => {
        await saveKami();
    }

    const handleDelete = async () => {
        await deleteKami();
    };

    const handleUndo = () => {
        processManager?.undo()?.forEach(process);
    }

    const handleRedo = () => {
        processManager?.redo()?.forEach(process);
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
                <HomeButton />
                <OptionMenu name="File">
                    <Option 
                        onClick={() => {}}
                        shortcut="Ctrl+N"
                        Icon={FaPlus}
                    >
                        New Kami file
                    </Option>
                    <Option 
                        onClick={() => {}}
                        shortcut="Ctrl+O"
                        Icon={FaRegFolder}
                    >
                        Open Kami file
                    </Option>
                    <Option
                        onClick={handleSave}
                        shortcut="Ctrl+S"
                        Icon={FaRegSave}
                    >
                        Save
                    </Option>
                    <Option 
                        onClick={handleDelete}
                        Icon={FaRegTrashCan}
                    >
                        Delete
                    </Option>
                </OptionMenu>
                <OptionMenu name="Edit">
                    <Option
                        onClick={handleUndo}
                        shortcut="Ctrl+Z"
                        Icon={FaUndo}
                    >
                        Undo
                    </Option>
                    <Option
                        onClick={handleRedo}
                        shortcut="Ctrl+Shift+Z"
                        Icon={FaRedo}
                    >
                        Redo
                    </Option>
                </OptionMenu>
                <OptionMenu name="View">
                    <Option 
                        onClick={() => handleRotate(1)}
                        shortcut="Ctrl+R"
                        Icon={FaRotateRight}
                    >
                        Rotate 90° right
                    </Option>
                    <Option 
                        onClick={() => handleRotate(-1)}
                        shortcut="Ctrl+L"
                        Icon={FaRotateLeft}
                    >
                        Rotate 90° left
                    </Option>
                    <Option 
                        onClick={() => {}}
                        shortcut="Ctrl+N"
                        Icon={FaEyeSlash}
                    >
                        Hide neutral creases
                    </Option>
                </OptionMenu>
                <TitleField />
                <div className="ml-auto h-full">
                    <OptionMenu
                        name="Settings"
                        Icon={FaEllipsis}
                        dropdownDirection="left"
                    >
                        <Option
                            onClick={kamiPublicityToggler.toggle}
                            Icon={
                                kamiPublicityToggler.inProgress ? Spinner :
                                kami.public ? MdLock : FaEarthAmericas
                            }
                        >
                            Make Kami { kami.public ? "private" : "public" }
                        </Option>
                    </OptionMenu>
                </div>
            </section>
            <OptionShadow />
        </>
    )
}