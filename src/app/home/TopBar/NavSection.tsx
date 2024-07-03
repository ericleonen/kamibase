import { capitalize } from "@/utils/string";
import { atom, useAtom } from "jotai";
import Image from "next/image";

type NavMenuOption = "create" | "settings" | "profile";
export const selectedNavMenuAtom = atom<NavMenuOption | undefined>(undefined);

export default function NavSection() {
    return (
        <div className="ml-auto flex">
            <NavMenu
                name="create"
                iconSrc="icons/plus.svg"
            >

            </NavMenu>
            <NavMenu
                name="settings"
                iconSrc="icons/settings.svg"
            >

            </NavMenu>
            <NavMenu
                name="profile"
                iconSrc="icons/profilePlaceholder.svg"
            >

            </NavMenu>
        </div>
    )
}

type NavMenuProps = {
    name: NavMenuOption,
    iconSrc: string,
    children?: React.ReactNode
}

function NavMenu({ name, iconSrc, children }: NavMenuProps) {
    const [selectedNavMenu, setSelectedNavMenu] = useAtom(selectedNavMenuAtom);

    const selected = name === selectedNavMenu;

    return (
        <div className="relative ml-8">
            <button 
                onClick={() => setSelectedNavMenu(name)}
                className="rounded-full hover:bg-theme-light-gray p-1"
                style={{
                    background: selected ? "var(--theme-yellow)" : undefined
                }}
            >
                <Image 
                    src={iconSrc}
                    alt={capitalize(name)}
                    height={32}
                    width={32}
                    className="h-8 w-8"
                />
            </button>
            <Dropdown show={selected}>{children}</Dropdown>
        </div>
    );
}

type DropdownProps = {
    show: boolean,
    children: React.ReactNode
}

function Dropdown({ show, children }: DropdownProps) {
    return show && (
        <div className="absolute rounded-lg shadow-md bg-theme-light-white p-2 z-10">
            {children}
        </div>
    )
}