"use client"

import { useLoadUser } from "@/db/user/read";

type AppLayoutProps = {
    children: React.ReactNode
}

function AppLayout({ children }: AppLayoutProps) {
    useLoadUser();

    return children;
}

export default AppLayout;