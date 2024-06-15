"use client"

import { Provider } from "jotai";

type ProvidersProps = {
    children: React.ReactNode
};

export default function Providers({ children }: ProvidersProps) {
    return (
        <Provider>
            {children}
        </Provider>
    )
}