import Image from "next/image";

export default function LeftSection() {
    return (
        <div className="flex flex-col justify-center px-5 h-full bg-theme-light-gray">
            <ToolButton
                name="Mountain tool"
                iconSrc="mountainToolIcon.svg"
            />
            <ToolButton
                name="Valley tool"
                iconSrc="valleyToolIcon.svg"
            />
            <ToolButton
                name="Neutral tool"
                iconSrc="neutralToolIcon.svg"
            />
            <ToolButton
                name="Eraser"
                iconSrc="eraserToolIcon.svg"
            />
        </div>
    )
}

type ToolButtonProps = {
    name: string,
    iconSrc: string
}

function ToolButton({ name, iconSrc }: ToolButtonProps) {
    return (
        <button className="bg-theme-gray hover:bg-theme-dark-gray h-16 w-16 rounded-md mb-5 last:mb-0 relative flex justify-center items-center">
            <Image 
                src={iconSrc}
                alt={`${name} tool`}
                height={45}
                width={45}
            />
        </button>
    )
}