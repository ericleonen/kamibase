import { useKamiSaveStatus, useKamiTitle } from "@/atoms/kami";

export default function TitleField() {
    const { kamiTitle, setKamiTitle } = useKamiTitle();
    const { setKamiSaveStatus } = useKamiSaveStatus();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setKamiTitle(e.target.value);
        setKamiSaveStatus("unsaved");
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