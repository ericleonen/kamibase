import Link from "next/link"

type NavButtonProps = {
    href: string,
    label: string,
    dark?: boolean,
    forMobile?: boolean
}

export default function NavButton({ href, label, dark, forMobile }: NavButtonProps) {
    const colors = dark ? "bg-theme-black hover:bg-theme-light-black text-theme-white" : 
        "hover:bg-theme-light-gray text-theme-black"

    const display = forMobile ? "" : "hidden sm:block";

    return (
        <Link 
            href={href}
            className={`${display} text-sm rounded-full ${colors} font-medium p-3 ml-3`}
        >
            {label}
        </Link>
    )
}