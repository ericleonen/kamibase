import { useAtom } from "jotai";
import { BiSearch } from "react-icons/bi";
import { showMobileSearchBarAtom } from ".";

export default function MobileSearchBarButton() {
    const [showMobileSearchBar, setShowMobileSearchBar] = useAtom(showMobileSearchBarAtom);

    const handleClick = () => {
        setShowMobileSearchBar(true);
    }
    
    return (
        <button 
            onClick={handleClick}
            className="h-[44px] w-[44px] rounded-full hover:bg-theme-light-gray sm:hidden transition-opacity"
            style={{
                opacity: showMobileSearchBar ? 0 : 1
            }}
        >
            <BiSearch className="text-lg text-theme-black m-auto" />
        </button>
    )
}