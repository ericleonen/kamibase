import { useCreateKami } from "@/db/kami/create";
import Kami from "@/origami/Kami";
import { FaPlus } from "react-icons/fa6";

export default function CreateButton() {
    const kamiCreator = useCreateKami();

    return (
        <button 
            onClick={() => kamiCreator.create("Untitled 8x8 kami", Kami.creaseGrid(8).toString(true))}
            className="flex text-sm items-center font-medium bg-theme-yellow text-theme-black p-3 rounded-lg"
        >
            <FaPlus className="mr-2" />
            Create a crease pattern
        </button>
    )
}