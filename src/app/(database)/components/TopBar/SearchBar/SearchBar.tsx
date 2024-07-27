import { useAtom } from "jotai";
import { BiSearch } from "react-icons/bi";
import { showMobileSearchBarAtom } from ".";
import MobileSearchBarButton from "./MobileSearchBarButton";
import { RefObject, useEffect, useRef } from "react";

function useAutoFocusableField(focus: boolean): RefObject<HTMLInputElement> {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const input = inputRef.current;

        if (focus && input) {
            input.focus();
        }
    }, [focus]);

    return inputRef;
}

export default function SearchBar() {
    const [showMobileSearchBar, setShowMobileSearchBar] = useAtom(showMobileSearchBarAtom);
    const inputRef = useAutoFocusableField(showMobileSearchBar);

    const handleBlur = () => {
        setShowMobileSearchBar(false);
    }

    return (
        <>
            <div 
                className="absolute top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%] flex opacity-0 w-0 sm:w-72 sm:opacity-100 p-3 overflow-hidden items-center bg-theme-light-gray rounded-full text-theme-darker-gray transition-[width,opacity]"
                style={{
                    width: showMobileSearchBar ? "calc(100% - 3rem)" : undefined,
                    opacity: showMobileSearchBar ? 1 : undefined
                }}
            >
                <BiSearch className="text-lg"/>
                <input 
                    ref={inputRef}
                    onBlur={handleBlur}
                    type="text"
                    placeholder="Search for CPs"
                    className="border-2 font-medium bg-transparent ml-2 focus:outline-none placeholder:text-theme-dark-gray text-sm"
                />
            </div>
            <MobileSearchBarButton />
        </>
    )
}