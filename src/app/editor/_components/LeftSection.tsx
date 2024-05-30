import Image from "next/image";

export default function LeftSection() {
    return (
        <div className="flex flex-col justify-center px-5 h-full bg-theme-light-gray">
            <ToolButton
                name="Point to point"
                iconSrc="pointToPointIcon.svg"
            />
            <ToolButton
                name="Angle bisector"
                iconSrc="angleBisectorIcon.svg"
            />
            <ToolButton
                name="Edge to edge"
                iconSrc="edgeToEdgeIcon.svg"
            />
            <ToolButton
                name="Eraser"
                iconSrc="eraserIcon.svg"
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