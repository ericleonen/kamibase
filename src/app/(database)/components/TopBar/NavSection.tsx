"use client"

import { useAtomValue } from "jotai"
import { showMobileSearchBarAtom } from "./SearchBar"
import Logo from "@/app/components/Logo";

export default function NavSection() {
    const showMobileSearchBar = useAtomValue(showMobileSearchBarAtom);

    return (
        <div
            className="flex items-center transition-opacity"
            style={{
                opacity: showMobileSearchBar ? 0 : 1
            }}
        >
            <Logo size="lg" />
        </div>
    )
}