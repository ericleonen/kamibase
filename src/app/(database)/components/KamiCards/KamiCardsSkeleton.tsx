import Skeleton from "@/app/components/Skeleton";

export default function KamiCardsSkeleton() {
    return <Skeleton className="w-[calc(100%-1.5rem)] sm:w-[calc(50%-1.5rem)] md:w-[calc(25%-1.5rem)] rounded-lg aspect-square m-3" n={4}/>
}