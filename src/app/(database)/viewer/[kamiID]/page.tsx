import { Suspense } from "react";
import TopBar from "../../components/TopBar";
import ViewerDisplay, { ViewerDisplaySkeleton } from "./components/ViewerDisplay";

type ViewerProps = {
    params: { kamiID: string }
}

export default async function Viewer({ params }: ViewerProps) {

    return (
        <div className="h-screen flex items-center flex-col bg-theme-white">
            <TopBar />
            <div className="h-[calc(100%-5rem)] w-full max-w-[500px] flex flex-col px-3 py-6 overflow-y-scroll">
                <Suspense fallback={<ViewerDisplaySkeleton />}>
                    <ViewerDisplay kamiID={params.kamiID} />
                </Suspense>
            </div>
        </div>
    )
}