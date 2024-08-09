"use client"

import { atom, useAtom } from "jotai";

const defaultShadow = {
    show: false,
    onClick: () => {}
};
export const shadowAtom = atom(defaultShadow);

export default function Shadow() {
    const [shadow, setShadow] = useAtom(shadowAtom);

    const handleClick = () => {
        shadow.onClick();
        setShadow(defaultShadow);
    }

    return shadow.show && (
        <div 
            onClick={handleClick}
            className="absolute h-screen w-screen left-0 top-0 z-20"
        />
    );
}