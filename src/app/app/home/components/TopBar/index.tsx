import Logo from "@/app/components/Logo";

export default function TopBar() {
    return (
        <section className="flex flex-between h-16 w-full relative px-3">
            <div className="absolute left-1/2 top-1/2 translate-x-[-50%] translate-y-[-50%]">
                <Logo size="lg" />
            </div>
        </section>
    )
}