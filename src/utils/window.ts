import { useEffect } from "react";

export function useUnsavedChangesPopup(changesSaved: boolean) {
    useEffect(() => {
        if (changesSaved) {
            const handler = (e: Event) => {
                e.preventDefault();
                confirm();
            }
    
            window.addEventListener("beforeunload", handler);
    
            return () => window.removeEventListener("beforeunload", handler);
        }
    }, [changesSaved]);
}