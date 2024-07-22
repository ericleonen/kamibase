"use client"

import { useLoadKami, usePathKamiID } from "@/db/kami/read";
import { useKamiImage } from "@/storage/kami/read";
import TopBar from "../../components/TopBar";
import { useAtomValue } from "jotai";
import { kamiAtom } from "@/atoms/kami";

export default function Viewer() {
    const kamiID = usePathKamiID();
    useLoadKami(kamiID);

    const kami = useAtomValue(kamiAtom);
    const kamiImage = useKamiImage(kamiID);

    return (
        <div className="h-screen items-center flex-col bg-theme-white">
            <TopBar />
            <div className="h-[calc(100%-5rem)] flex items-center p-6 justify-center">
                <img
                    src={kamiImage.src}
                    alt={kami.title}
                    className="h-auto w-auto max-h-full rounded-lg border-2 border-theme-gray"
                />
                <div>
                    
                </div>
            </div>
        </div>
    )
}