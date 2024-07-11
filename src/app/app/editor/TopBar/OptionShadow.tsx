import { useAtom } from "jotai"
import { optionMenuAtom } from "./OptionMenu";

export default function OptionShadow() {
    const [optionMenu, setOptionMenu] = useAtom(optionMenuAtom);

    return optionMenu && (
        <div 
            onClick={() => setOptionMenu(undefined)}
            className="absolute h-[calc(100vh-4rem)] w-screen top-16 left-0 z-10"
        />
    )
}