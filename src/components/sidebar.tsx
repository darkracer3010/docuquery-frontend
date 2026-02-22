"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
    FileText,
    MessageSquare,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Trash2,
    Plus,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { useState, useEffect } from "react";
import { api, type Conversation } from "@/lib/api";

const navItems = [
    { href: "/documents", label: "Documents", icon: FileText },
    { href: "/chat", label: "Chat", icon: MessageSquare },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        const email = localStorage.getItem("user_email");
        setUserEmail(email);

        if (pathname === "/chat") {
            loadConversations();
        }

        // Listen for conversation updates
        const handleConversationUpdate = () => {
            if (pathname === "/chat") {
                loadConversations();
            }
        };
        
        window.addEventListener('conversationUpdated', handleConversationUpdate);
        
        return () => {
            window.removeEventListener('conversationUpdated', handleConversationUpdate);
        };
    }, [pathname]);

    const loadConversations = async () => {
        setLoadingHistory(true);
        try {
            const res = await api.listConversations();
            setConversations(res);
        } catch (err) {
            console.error("Failed to load conversations", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
        // Stop all propagation immediately
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();

        console.log("Delete clicked for", id);

        try {
            console.log("Sending delete request...");
            await api.deleteConversation(id);
            console.log("Delete successful!");

            // Immediately update UI
            setConversations((prev) => prev.filter((c) => c.id !== id));

            // If the deleted conversation is the active one, redirect to new chat
            if (searchParams.get("id") === id) {
                router.push("/chat");
            }
        } catch (err) {
            console.error("Delete failed:", err);
            alert("Failed to delete conversation: " + (err instanceof Error ? err.message : String(err)));
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user_email");
        localStorage.removeItem("user_id");
        router.push("/login");
    };

    return (
        <>
            {/* Mobile overlay */}
            {mobileOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}
            
            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{ 
                    width: collapsed ? 72 : 260,
                }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={`h-screen flex flex-col border-r sticky top-0 z-50 ${
                    mobileOpen ? 'fixed left-0' : 'hidden lg:flex'
                }`}
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

                {/* Chat History Section */}
                {pathname === "/chat" && !collapsed && (
                    <div className="mt-6">
                        <div className="flex items-center justify-between px-3 mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Recent Chats
                            </span>
                            <button
                                onClick={() => router.push("/chat")}
                                className="p-1 rounded hover:bg-secondary text-primary transition-colors"
                                title="New Chat"
                            >
                                <Plus size={14} />
                            </button>
                        </div>

                        <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1 thin-scrollbar">
                            {conversations.map((conv) => {
                                const isActive = searchParams.get("id") === conv.id;
                                return (
                                    <div key={conv.id} className="relative group">
                                        <Link href={`/chat?id=${conv.id}`}>
                                            <div
                                                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50"
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <MessageSquare size={16} className="flex-shrink-0" />
                                                    <span className="text-sm truncate">{conv.title}</span>
                                                </div>
                                                {/* Empty spacer for the absolute button */}
                                                <div className="w-6 flex-shrink-0" />
                                            </div>
                                        </Link>
                                        <button
                                            onClick={(e) => handleDeleteConversation(e, conv.id)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 hover:text-danger transition-opacity z-10"
                                            title="Delete conversation"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                );
                            })}

                            {!loadingHistory && conversations.length === 0 && (
                                <p className="text-xs text-center py-4 text-muted-foreground italic">
                                    No history yet
                                </p>
                            )}

                            {loadingHistory && (
                                <div className="space-y-2 px-3">
                                    <div className="h-8 w-full bg-secondary animate-pulse rounded-lg" />
                                    <div className="h-8 w-full bg-secondary animate-pulse rounded-lg" />
                                </div>
                            )}
                        </div>
                    </div>
                )}
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

                <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : 'justify-between'}`}>
                    <ThemeToggle collapsed={collapsed} />

                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleLogout}
                        className="p-2 rounded-lg transition-colors"
                        style={{ background: "var(--secondary)", color: "var(--danger)" }}
                        aria-label="Logout"
                        title="Logout"
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
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </motion.button>
                </div>
            </div>
        </motion.aside>
        
        {/* Mobile menu button */}
        <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg"
            style={{ background: "var(--primary)", color: "white" }}
        >
            <MessageSquare size={24} />
        </button>
    </>
    );
}
