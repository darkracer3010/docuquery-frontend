"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export default function LoginPage() {
    const router = useRouter();
    const [tab, setTab] = useState<"login" | "signup">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const response =
                tab === "login"
                    ? await api.login(email, password)
                    : await api.signup(email, password, fullName);

            if (response.access_token) {
                localStorage.setItem("access_token", response.access_token);
                localStorage.setItem("refresh_token", response.refresh_token || "");
                localStorage.setItem("user_email", response.email || "");
                localStorage.setItem("user_id", response.user_id || "");
                router.push("/");
            } else {
                setError(tab === "signup" ? "Check your email to confirm signup." : "Login failed.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center p-4"
            style={{ background: "var(--background)" }}
        >
            {/* Background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-10"
                    style={{ background: "var(--primary)" }}
                />
                <div
                    className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-10"
                    style={{ background: "var(--accent)" }}
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative"
            >
                {/* Logo */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: "var(--primary)" }}
                    >
                        <Sparkles size={28} color="white" />
                    </motion.div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        DocuQuery
                    </h1>
                    <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
                        AI-powered document intelligence
                    </p>
                </div>

                {/* Card */}
                <div
                    className="rounded-2xl p-6 glass"
                    style={{ border: "1px solid var(--border)" }}
                >
                    {/* Tabs */}
                    <div
                        className="flex rounded-lg p-1 mb-6"
                        style={{ background: "var(--secondary)" }}
                    >
                        {(["login", "signup"] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => { setTab(t); setError(""); }}
                                className="flex-1 py-2 rounded-md text-sm font-medium transition-all"
                                style={{
                                    background: tab === t ? "var(--primary)" : "transparent",
                                    color: tab === t ? "var(--primary-foreground)" : "var(--muted-foreground)",
                                }}
                            >
                                {t === "login" ? "Sign In" : "Sign Up"}
                            </button>
                        ))}
                    </div>

                    {/* Error */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-4 p-3 rounded-lg text-sm"
                                style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)" }}
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <AnimatePresence mode="wait">
                            {tab === "signup" && (
                                <motion.div
                                    key="name"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                >
                                    <div className="relative">
                                        <User
                                            size={16}
                                            className="absolute left-3 top-1/2 -translate-y-1/2"
                                            style={{ color: "var(--muted-foreground)" }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Full name"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-lg border text-sm outline-none transition-all focus:ring-2"
                                            style={{
                                                background: "var(--input)",
                                                borderColor: "var(--border)",
                                                color: "var(--foreground)",
                                                ["--tw-ring-color" as string]: "var(--ring)",
                                            }}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="relative">
                            <Mail
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2"
                                style={{ color: "var(--muted-foreground)" }}
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full pl-10 pr-4 py-3 rounded-lg border text-sm outline-none transition-all focus:ring-2"
                                style={{
                                    background: "var(--input)",
                                    borderColor: "var(--border)",
                                    color: "var(--foreground)",
                                }}
                            />
                        </div>

                        <div className="relative">
                            <Lock
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2"
                                style={{ color: "var(--muted-foreground)" }}
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full pl-10 pr-4 py-3 rounded-lg border text-sm outline-none transition-all focus:ring-2"
                                style={{
                                    background: "var(--input)",
                                    borderColor: "var(--border)",
                                    color: "var(--foreground)",
                                }}
                            />
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            style={{
                                background: "var(--primary)",
                                color: "var(--primary-foreground)",
                            }}
                        >
                            {loading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    {tab === "login" ? "Sign In" : "Create Account"}
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </motion.button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
