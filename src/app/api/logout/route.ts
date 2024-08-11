import { cookies } from "next/headers";

export async function POST(req: Request) {
    cookies().delete("__session");

    return new Response("User logged out", {
        status: 200
    });
}