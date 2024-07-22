import { kamiAtom, useSetKami } from "@/atoms/kami";
import { useAtomValue } from "jotai";

export default function TitleField() {
    const kamiTitle = useAtomValue(kamiAtom).title;
    const setKami = useSetKami();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setKami({
            title: e.target.value,
            saveStatus: "unsaved"
        });
    }

    return (
        <input
            className="text-theme-white font-medium border-none bg-transparent focus:outline-none text-center absolute left-1/2 top-1/2 translate-x-[-50%] translate-y-[-50%]"
            type="text"
            value={kamiTitle}
            onChange={handleChange}
        />
    )
}