"use client"

import { useAutoLogIn } from "@/auth/login";

export default function Home() {
  useAutoLogIn();

  return undefined;
}