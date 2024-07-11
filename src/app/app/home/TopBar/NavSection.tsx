import { userAtom } from "@/auth/atoms";
import { useLogOut } from "@/auth/logOut";
import { capitalize } from "@/utils/string";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import Image from "next/image";

type NavMenuOption = "create" | "settings" | "profile";
export const selectedNavMenuAtom = atom<NavMenuOption | undefined>(undefined);

export default function NavSection() {
    const { isLoggingOut, logOut } = useLogOut();
    const { name } = useAtomValue(userAtom);

    return (
        <div className="ml-auto h-full flex">
            <NavMenu
                name="create"
                iconSrc="/icons/plus.svg"
            >
                <Option>New blank</Option>
                <Option>New precreased 8&times;8 grid</Option>
                <Option>New precreased 16&times;16 grid</Option>
                <Option>New precreased 32&times;32 grid</Option>
            </NavMenu>
            <NavMenu
                name="settings"
                iconSrc="/icons/settings.svg"
            >

            </NavMenu>
            <NavMenu
                name="profile"
                iconSrc="/icons/profilePlaceholder.svg"
            >
                <Option onClick={logOut}>Log out {name}</Option>
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
        <div className="relative h-full ml-8 flex items-center">
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
        <div className="flex flex-col absolute rounded-lg shadow-md bg-theme-light-white py-2 z-10 top-[calc(100%+8px)] right-2 w-max min-w-64 border border-theme-light-gray">
            {children}
        </div>
    )
}

type OptionProps = {
    onClick?: () => void,
    children: React.ReactNode
}

function Option({ onClick, children }: OptionProps) {
    const setSelectedNavMenu = useSetAtom(selectedNavMenuAtom);

    const handleClick = () => {
        if (onClick) {
            onClick();
            setSelectedNavMenu(undefined);
        }
    }

    return (
        <button
            onClick={handleClick}
            className="flex px-3 py-2 first:mt-1 mb-1 hover:bg-theme-light-gray text-theme-black font-medium text-sm"
        >
            {children}
        </button>
    )
}