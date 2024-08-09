import { useState } from "react";
import { FaPlus } from "react-icons/fa6";
import CreateMenu from "./CreateMenu";
import Spinner from "@/app/components/Spinner";
import { useSetAtom } from "jotai";
import { shadowAtom } from "@/app/components/Shadow";

export default function CreateSection() {
    const setShadow = useSetAtom(shadowAtom);
    const [showMenu, setShowMenu] = useState(false);

    const handleClick = () => {
        setShowMenu(true);
        setShadow({
            show: true,
            onClick: () => setShowMenu(false)
        });
    }

    return (
        <>
            <div className="h-full relative hidden sm:block">
                <button 
                    onClick={handleClick}
                    className="flex text-sm items-center font-medium bg-theme-black hover:bg-theme-light-black text-theme-white py-3 px-5 rounded-full"
                >
                    { !showMenu ? <FaPlus className="mr-2" /> : <Spinner className="mr-2" />}
                    Create a CP
                </button>
                <CreateMenu show={showMenu} />
            </div>
        </>
    )
}