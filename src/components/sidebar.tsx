"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    FileText,
    MessageSquare,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Sparkles,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { useState, useEffect } from "react";

const navItems = [
    { href: "/", label: "Documents", icon: FileText },
    { href: "/chat", label: "Chat", icon: MessageSquare },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        const email = localStorage.getItem("user_email");
        setUserEmail(email);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user_email");
        localStorage.removeItem("user_id");
        router.push("/login");
    };

    return (
        <motion.aside
            initial={false}
            animate={{ width: collapsed ? 72 : 260 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="h-screen flex flex-col border-r sticky top-0"
            style={{
                background: "var(--card)",
                borderColor: "var(--border)",
            }}
        >
            {/* Logo */}
            <div className="p-4 flex items-center gap-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--primary)" }}
                >
                    <Sparkles size={18} color="white" />
                </div>
                {!collapsed && (
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"
                    >
                        DocuQuery
                    </motion.span>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 p-3 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link key={item.href} href={item.href}>
                            <motion.div
                                whileHover={{ x: 4 }}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer ${isActive ? "font-medium" : ""
                                    }`}
                                style={{
                                    background: isActive ? "var(--primary)" : "transparent",
                                    color: isActive ? "var(--primary-foreground)" : "var(--secondary-foreground)",
                                }}
                            >
                                <item.icon size={20} />
                                {!collapsed && <span>{item.label}</span>}
                            </motion.div>
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom */}
            <div className="p-3 space-y-2 border-t" style={{ borderColor: "var(--border)" }}>
                {/* User info */}
                {!collapsed && userEmail && (
                    <div
                        className="px-3 py-2 rounded-lg text-xs truncate"
                        style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
                    >
                        {userEmail}
                    </div>
                )}

                <div className="flex items-center justify-between gap-2">
                    <ThemeToggle />

                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleLogout}
                        className="p-2 rounded-lg transition-colors"
                        style={{ background: "var(--secondary)", color: "var(--danger)" }}
                        aria-label="Logout"
                    >
                        <LogOut size={18} />
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setCollapsed(!collapsed)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ background: "var(--secondary)", color: "var(--foreground)" }}
                        aria-label="Toggle sidebar"
                    >
                        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </motion.button>
                </div>
            </div>
        </motion.aside>
    );
}
