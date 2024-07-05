import Image from "next/image"

export default function Logo() {
    return (
        <Image 
            src="logo.svg"
            alt="KamiBase logo"
            height={86}
            width={20}
            priority
            className="w-auto h-auto"
        />
    )
}