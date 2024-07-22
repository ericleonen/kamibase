import { useAtom } from "jotai";
import Image from "next/image";
import { Tool, toolAtom } from "@/atoms/kami";

export default function ToolSection() {
    return (
        <div className="fixed flex flex-col justify-center px-5 h-full bg-theme-light-gray">
            <ToolButton
                name="Mountain"
                iconSrc="/icons/mountainTool.svg"
            />
            <ToolButton
                name="Valley"
                iconSrc="/icons/valleyTool.svg"
            />
            <ToolButton
                name="Neutral"
                iconSrc="/icons/neutralTool.svg"
            />
            <ToolButton
                name="Eraser"
                iconSrc="/icons/eraserTool.svg"
            />
        </div>
    )
}

type ToolButtonProps = {
    name: string,
    iconSrc: string
}

function ToolButton({ name, iconSrc }: ToolButtonProps) {
    const [selectedTool, setSelectedTool] = useAtom(toolAtom);
    const tool: Tool = name.charAt(0) as Tool;

    const isSelected = tool === selectedTool;

    const handleClick = () => {
        setSelectedTool(tool);
    };

    return (
        <button 
            onClick={handleClick}
            className="transition-colors bg-theme-gray hover:bg-theme-dark-gray h-16 w-16 rounded-md mb-5 last:mb-0 relative flex justify-center items-center"
            style={{
                background: isSelected ? "rgb(var(--theme-yellow))" : undefined
            }}
        >
            <Image 
                src={iconSrc}
                alt={`${name} tool`}
                height={45}
                width={45}
                priority
                className="w-auto h-auto p-2"
            />
        </button>
    )
}