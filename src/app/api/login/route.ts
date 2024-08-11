import { adminAuth } from "@/firebase/admin";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const idToken = headers().get("Authorization")
        ?.split(" ")[1];

    try {
        if (!idToken) {
            throw new Error();
        }
        const sessionCookie = await adminAuth.createSessionCookie(idToken, {
            expiresIn: 1000 * 60 * 60 * 24 * 7 * 2
        });

        cookies().set("__session", sessionCookie, {
            httpOnly: true,
            sameSite: "lax",
            secure: true
        });
    
        return NextResponse.json({
            succeeded: true
        });
    } catch (err) {
        console.error(err);

        return NextResponse.json({
            succeeded: false
        });
    }
}