import Logo from "../../components/Logo"

type ContainerProps = {
    preText: string,
    onSubmit: (e: React.FormEvent) => void
    children?: React.ReactNode
}

export default function Form({ preText, onSubmit, children }: ContainerProps) {
    return (
        <form 
            onSubmit={onSubmit}
            className="flex flex-col items-center"
        >
            <div className="flex mb-3">
                <p className="mr-1 font-bold text-theme-black">{preText}</p>
                <Logo />
            </div>
            {children}
        </form>
    )
}