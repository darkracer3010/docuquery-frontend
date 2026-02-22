"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { api } from "@/lib/api";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        if (!api.isAuthenticated()) {
            router.push("/login");
        } else {
            setAuthenticated(true);
        }
    }, [router]);

    if (!authenticated) return null;

    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-auto w-full" style={{ background: "var(--background)" }}>
                {children}
            </main>
        </div>
    );
}
