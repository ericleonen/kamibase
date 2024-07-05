import Logo from "../../components/Logo"

type ContainerProps = {
    preText: string,
    children?: React.ReactNode
}

export default function Container({ preText, children }: ContainerProps) {
    return (
        <div className="flex flex-col items-center">
            <div className="flex mb-3">
                <p className="mr-1 font-bold text-theme-black">{preText}</p>
                <Logo />
            </div>
            {children}
        </div>
    )
}