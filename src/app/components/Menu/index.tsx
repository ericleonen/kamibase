import { useSetAtom } from "jotai"
import { shadowAtom } from "../Shadow"
import { useState } from "react";

export function useMenu(): {
    open: () => void,
    close: () => void,
    show: boolean
} {
    const setShadow = useSetAtom(shadowAtom);
    const [show, setShow] = useState(false);

    return {
        open: () => {
            setShow(true);
            setShadow({
                show: true,
                onClick: () => setShow(false)
            });
        },
        close: () => {
            setShow(false);
            setShadow({
                show: false,
                onClick: () => {}
            });
        },
        show
    };
}