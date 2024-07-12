"use client"

import { useLoadUser } from "@/db/user/read";

type AppLayoutProps = {
    children: React.ReactNode
}

function AppLayout({ children }: AppLayoutProps) {
    const loadUserError = useLoadUser();

    return children;
}

export default AppLayout;