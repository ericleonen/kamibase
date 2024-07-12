export function KamiDisplayLoader() {
    return (
        <span className="absolute top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%]">KamiDisplayLoader</span>
    )
}

type KamiDisplayErrorProps = {
    error?: Error
}

export function KamiDisplayError({ error }: KamiDisplayErrorProps) {
    return (
        <span className="absolute top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%]">KamiDisplayError: {error?.message}</span>
    )
}