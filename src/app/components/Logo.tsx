import Image from "next/image"
import Link from "next/link";

type LogoProps = {
    size?: "sm" | "md" | "lg"
};

export default function Logo({ size }: LogoProps) {
    const sizeScaler = size === "sm" ? 14 / 16 :
        size === "lg" ? 20 / 16 : 1;
    
    return (
        <Link href="/">
            <Image 
                src="/logo.svg"
                alt="KamiBase logo"
                width={86 * sizeScaler}
                height={20 * sizeScaler}
                priority
                style={{
                    width: `${86 * sizeScaler}px`,
                    height: `${20 * sizeScaler}px`
                }}
            />
        </Link>
    )
}