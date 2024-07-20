import { useRouter } from "next/navigation";
import { FaHouse } from "react-icons/fa6";

export default function HomeButton() {
    const router = useRouter();

    const handleClick = () => {
        router.push("/app/home");
    }

    return (
        <button 
            className="h-full flex items-center justify-center px-6 hover:bg-theme-light-black transition-colors"
            onClick={handleClick}
        >
            <FaHouse className="text-theme-white" />
        </button>
    )
}