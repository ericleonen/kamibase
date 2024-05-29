import Image from "next/image";

export default function LeftSection() {
    return (
        <div className="flex flex-col justify-center px-5 h-full bg-theme-light-gray">
            <ToolButton>
                <Image src="/pointToPointIcon.svg" alt="Point to point tool" height={40} width={40} />
            </ToolButton>
            <ToolButton>
                1
            </ToolButton>
            <ToolButton>
                1
            </ToolButton>
            <ToolButton>
                1
            </ToolButton>
        </div>
    )
}

type ToolButtonProps = {
    children: React.ReactNode
}

function ToolButton({ children }: ToolButtonProps) {
    return (
        <button className="bg-theme-gray h-16 w-16 rounded-md mb-5 last:mb-0 relative flex justify-center items-center">
            {children}
        </button>
    )
}