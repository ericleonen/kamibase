import { useKeyDown } from "@/utils/input";
import { atom, useAtom, useSetAtom } from "jotai";

export const optionMenuAtom = atom<string | undefined>(undefined);

type OptionMenuProps = {
    name: string,
    children?: React.ReactNode
}

export default function OptionMenu({ name, children }: OptionMenuProps) {
    const [optionMenu, setOptionMenu] = useAtom(optionMenuAtom);

    const selected = optionMenu === name;

    return (
        <div className="relative text-sm">
            <button
                onClick={() => setOptionMenu(name)}
                className="transition-colors hover:bg-theme-light-black flex items-center px-6 h-full"
                style={{
                    background: selected ? "rgb(var(--theme-yellow))" : undefined,
                    color: selected ? "rgb(var(--theme-black))" : "rgb(var(--theme-white))"
                }}
            >
                {name}
            </button>
            <Dropdown show={selected}>{children}</Dropdown>
        </div>
    )
}

type DropdownProps = {
    show: boolean,
    children: React.ReactNode
}

function Dropdown({ show, children }: DropdownProps) {
    return (
        <div
            style={{
                display: show ? "block" : "none"
            }}
        >
            <div 
                className="absolute top-[calc(100%+2.5px)] left-1/2 translate-x-[-50%] z-20 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-theme-black"
            />
            <div className="text-sm absolute top-[calc(100%+8px)] left-[4px] z-20 flex flex-col bg-theme-black w-max rounded-sm">
                {children}
            </div>
        </div>
    )
}

type OptionProps = {
    onClick: () => void
    shortcut?: string,
    children: React.ReactNode
}

export function Option({ onClick, shortcut, children }: OptionProps) {
    const setOptionMenu = useSetAtom(optionMenuAtom);

    const handleClick = () => {
        Promise.resolve(onClick())
            .then(() => setOptionMenu(undefined));
    };

    useKeyDown(shortcut, onClick);

    return (
        <button
            onClick={handleClick}
            className="flex px-3 py-2 justify-between first:mt-1 mb-1 hover:bg-theme-light-black"
        >
            <p className="text-theme-gray">{children}</p>
            <p className="ml-12 text-theme-dark-gray">{shortcut}</p>
        </button>
    )
}