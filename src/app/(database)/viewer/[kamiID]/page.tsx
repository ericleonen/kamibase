"use client"

import { useLoadViewableKami, usePathKamiID } from "@/db/kami/read";
import { useKamiImage } from "@/storage/kami/read";
import TopBar from "../../components/TopBar";
import { useAtomValue } from "jotai";
import { viewableKamiAtom } from "@/atoms/kami";

export default function Viewer() {
    const kamiID = usePathKamiID();
    useLoadViewableKami(kamiID);

    const viewableKami = useAtomValue(viewableKamiAtom);

    return (
        <div className="h-screen items-center flex-col bg-theme-white">
            <TopBar />
            <div className="flex p-6 justify-center h-[500px]">
                <img
                    src={viewableKami.src}
                    alt={viewableKami.title}
                    className="mt-6 h-auto w-auto rounded-lg border-2 border-theme-gray"
                />
                <div className="flex flex-col items-center ml-12">
                    <h1 className="text-5xl font-bold text-theme-black">{viewableKami.title}</h1>
                    <p className="text-theme-black p-2 rounded-full bg-theme-blue text-sm">{viewableKami.userName}</p>
                </div>
            </div>
        </div>
    )
}