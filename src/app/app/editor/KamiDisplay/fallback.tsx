import { kamiAtom } from "@/atoms/kami"
import { useAtomValue } from "jotai"
import { LuLoader2 } from "react-icons/lu";

export function KamiDisplayLoader() {
    return (
        <div className="absolute top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%] flex flex-col justify-center items-center font-medium text-theme-darker-gray">
            <LuLoader2 className="animate-spin text-2xl"/>
            <span className="mt-2">Loading Kami</span>
        </div>
    )
}

export function KamiDisplayError() {
    const kamiError = useAtomValue(kamiAtom).error;

    return (
        <span className="absolute top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%]">KamiDisplayError: {kamiError?.message}</span>
    )
}