import Skeleton from "@/app/components/Skeleton";

export default function ViewerDisplaySkeleton() {
    return (
        <>
            <Skeleton className="h-[2.25rem] w-full rounded-full" />
            <Skeleton className="h-[2.25rem] w-1/2 mt-2 ml-1 rounded-full" />
            <Skeleton className="w-full aspect-square mt-6 rounded-lg"/>
        </>
    );
}