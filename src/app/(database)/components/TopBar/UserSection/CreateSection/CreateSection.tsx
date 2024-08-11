import { FaPlus } from "react-icons/fa6";
import CreateMenu from "./CreateMenu";
import Spinner from "@/app/components/Spinner";
import { useMenu } from "@/app/components/Menu";

export default function CreateSection() {
    const createMenu = useMenu();

    return (
        <div className="h-full relative hidden sm:block">
            <button 
                onClick={createMenu.open}
                className="flex text-sm items-center font-medium bg-theme-black hover:bg-theme-light-black text-theme-white py-3 px-5 rounded-full"
            >
                { !createMenu.show ? <FaPlus className="mr-2" /> : <Spinner className="mr-2" />}
                Create a CP
            </button>
            <CreateMenu show={createMenu.show} />
        </div>
    )
}