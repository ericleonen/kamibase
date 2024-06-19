import { atom, useAtom } from "jotai";
import React, { useState } from "react"

export const optionAtom = atom<string | undefined>(undefined);

type OptionProps = {
    name: string,
    children?: React.ReactNode
}

export default function Option({ name, children }: OptionProps) {
    const [option, setOption] = useAtom(optionAtom);

    const selected = option === name;

    return (
        <div className="relative text-sm">
            <button
                onClick={() => setOption(name)}
                className="transition-colors hover:bg-theme-light-black flex items-center px-6 h-full"
                style={{
                    background: selected ? "var(--theme-yellow)" : undefined,
                    color: selected ? "var(--theme-black)" : "var(--theme-white)"
                }}
            >
                {name}
            </button>
            { selected && <Dropdown>{children}</Dropdown> }
        </div>
    )
}

type DropdownProps = {
    children: React.ReactNode
}

function Dropdown({ children }: DropdownProps) {
    return (
        <>
            <div 
                className="absolute top-[calc(100%+2px)] left-1/2 translate-x-[-50%] z-20 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-theme-black"
            />
            <div className="text-sm absolute top-[calc(100%+8px)] left-[4px] z-20 flex flex-col bg-theme-black w-max rounded-sm">
                {children}
            </div>
        </>
    )
}

type ActionProps = {
    onClick: () => void
    shortcut?: string,
    children: React.ReactNode
}

export function Action({ onClick, shortcut, children }: ActionProps) {
    return (
        <button
            onClick={onClick}
            className="flex px-3 py-1 justify-between first:mt-1 mb-1 hover:bg-theme-light-black"
        >
            <p className="text-theme-gray">{children}</p>
            <p className="ml-12 text-theme-dark-gray">{shortcut}</p>
        </button>
    )
}