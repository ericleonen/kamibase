import { ElementType, ReactNode } from "react"

type OptionProps = {
    onClick: () => void,
    Icon: ElementType,
    children: ReactNode
}

export default function Option({ onClick, Icon, children }: OptionProps) {
    return (
        <button
            onClick={onClick}
            className="flex p-2 text-sm items-center text-theme-black font-medium hover:bg-theme-light-gray rounded-lg"
        >
            <Icon className="mr-2" />
            {children}
        </button>
    )
}