import { useAtom } from "jotai";
import { selectedNavMenuAtom } from "./NavSection";

export default function NavShadow() {
    const [selectedNavMenu, setSelectedNavMenu] = useAtom(selectedNavMenuAtom);
    
    return selectedNavMenu && (
        <div
            onClick={() => setSelectedNavMenu(undefined)}
            className="h-screen w-screen absolute top-0 left-0"
        />
    );
}