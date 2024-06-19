import { useAtom } from "jotai"
import { optionAtom } from "./Option";

export default function OptionShadow() {
    const [option, setOption] = useAtom(optionAtom);

    return option && (
        <div 
            onClick={() => setOption(undefined)}
            className="absolute h-[calc(100vh-4rem)] w-screen top-16 left-0 z-10"
        />
    )
}