import { capitalize } from "@/utils/string"
import { FoldType } from "@/types/paradigm"

export default function RightSection() {
    return (
        <div className="w-80 h-full bg-theme-light-gray flex flex-col">
            <FoldTypeArea />
        </div>
    )
}

function FoldTypeArea() {
    const foldTypes: FoldType[] = ["mountain", "neutral", "valley"];

    return (
        <ToolArea name="Fold type">
            <div className="flex w-full justify-around">
                {
                    foldTypes.map(foldType => (
                        <FoldTypeChoice 
                            type={foldType}
                            active={foldType === "mountain"}
                        />
                    ))
                }
            </div>
        </ToolArea>
    )
}

type FoldTypeChoice = {
    type: FoldType,
    active: boolean
}

function FoldTypeChoice({ type, active }: FoldTypeChoice) {
    return (
        <button 
            className="py-1 px-3 rounded-full hover:bg-theme-gray"
            style={active ? {
                backgroundColor: "var(--theme-yellow)"
            } : {}}
        >
            {capitalize(type)}
        </button>
    )
}

type ToolAreaProps = {
    name: string,
    children: React.ReactNode
}

function ToolArea({ name, children }: ToolAreaProps ) {
    return (
        <div className="flex flex-col">
            <div className="w-full py-2 text-center text-black font-medium bg-theme-gray">{name}</div>
            <div className="p-6 flex flex-col items-center">
                {children}
            </div>
        </div>
    )
}