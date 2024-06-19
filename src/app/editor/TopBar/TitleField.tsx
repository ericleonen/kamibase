import { useState } from "react";

export default function TitleField() {
    const [title, setTitle] = useState("Unititled kami");

    return (
        <input
            className="text-theme-white font-medium border-none bg-transparent focus:outline-none text-center absolute left-1/2 top-1/2 translate-x-[-50%] translate-y-[-50%]"
            type="text"
            value={title}
            onChange={({ target }) => setTitle(target.value)}
        />
    )
}