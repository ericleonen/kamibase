import { ReactNode } from "react"

type SkeletonProps = {
    className: string,
    n?: number
}

export default function Skeleton({ className, n }: SkeletonProps) {
    if (!n || n <= 1) {
        return (
            <div className={`bg-theme-light-gray animate-pulse text-transparent ${className}`} />
        );
    } else {
        return Array.from(Array(n)).map((_, i) =>
            <Skeleton className={className} key={`skeleton_${i}`}/>
        );
    }
}