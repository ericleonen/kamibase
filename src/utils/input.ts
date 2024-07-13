import { useCallback, useEffect } from "react";

export function useKeyDown(code: string | undefined, callback: () => void) {    
    const handler = useCallback((e: KeyboardEvent) => {
        const codeKeys = code ? code.split("+") : [];

        if (e.ctrlKey && codeKeys.shift() !== "Ctrl") return;
        if (e.shiftKey && codeKeys.shift() !== "Shift") return;
        if (e.key && codeKeys.shift() !== e.key.toUpperCase()) return;

        e.preventDefault();
        e.stopPropagation();

        callback();
    }, [callback]);

    useEffect(() => {
        if (!code) return;

        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [handler]);
}