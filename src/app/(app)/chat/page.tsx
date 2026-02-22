"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Send,
    Sparkles,
    User,
    FileText,
    ChevronDown,
    ChevronUp,
    Zap,
    BookOpen,
    Search,
    Square,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { api, type QAResponse, type SourceCitation, type RetrievalMetadata } from "@/lib/api";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    sources?: SourceCitation[];
    metadata?: RetrievalMetadata;
    loading?: boolean;
    conversation_id?: string;
}

const SUGGESTIONS = [
    "What are the key findings in this document?",
    "Summarize the main points",
    "What data or statistics are mentioned?",
    "Explain the conclusions",
];

export default function ChatPage() {
    const searchParams = useSearchParams();
    const router = useRouter(); // We need router to update URL
    const activeConvId = searchParams.get("id");

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [conversationId, setConversationId] = useState<string | undefined>(activeConvId || undefined);
    const [isInputFocused, setIsInputFocused] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeConvId) {
            setConversationId(activeConvId);
            loadMessages(activeConvId);
        } else {
            setConversationId(undefined);
            setMessages([]);
        }
    }, [activeConvId]);

    const loadMessages = async (id: string) => {
        setLoading(true);
        try {
            const history = await api.getConversationMessages(id);
            const formatted: Message[] = history.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                sources: m.sources,
                metadata: m.metadata,
                conversation_id: m.conversation_id
            }));
            setMessages(formatted);
        } catch (err) {
            console.error("Failed to load history", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    const handleSend = async (question?: string) => {
        const q = question || input.trim();
        if (!q || loading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: q,
        };

        const assistantMsgId = (Date.now() + 1).toString();
        const loadingMsg: Message = {
            id: assistantMsgId,
            role: "assistant",
            content: "",
            loading: true,
        };

        setMessages((prev) => [...prev, userMsg, loadingMsg]);
        setInput("");
        setLoading(true);

        const controller = new AbortController();
        setAbortController(controller);

        // Keep track if we need to update the URL after the first response
        let firstToken = true;

        await api.askQuestionStream(
            q,
            undefined, // Always query all documents
            conversationId,
            {
                onToken: (token) => {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMsgId
                                ? { ...m, content: m.content + token, loading: false }
                                : m
                        )
                    );
                },
                onSources: (sources) => {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMsgId ? { ...m, sources } : m
                        )
                    );
                },
                onMetadata: (metadata) => {
                    // Update conversationId if it's a new conversation
                    if (metadata.conversation_id && !conversationId) {
                        setConversationId(metadata.conversation_id);
                        // Update URL without full refresh to preserve state
                        const url = new URL(window.location.href);
                        url.searchParams.set("id", metadata.conversation_id);
                        window.history.pushState({}, "", url.toString());
                    }

                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMsgId ? { ...m, metadata } : m
                        )
                    );
                },
                onDone: () => {
                    setLoading(false);
                    // Trigger event to refresh conversation list in sidebar
                    window.dispatchEvent(new CustomEvent('conversationUpdated'));
                },
                onError: (error) => {
                    // Handle abort gracefully - just stop loading, don't show error
                    if (error.includes("aborted") || error.includes("AbortError") || error.includes("BodyStreamBuffer")) {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantMsgId && m.loading
                                    ? { ...m, loading: false, content: m.content || "Response stopped." }
                                    : m
                            )
                        );
                    } else {
                        // Show actual errors
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantMsgId
                                    ? { ...m, content: `Error: ${error}`, loading: false }
                                    : m
                            )
                        );
                    }
                    setLoading(false);
                    setAbortController(null);
                },
            },
            controller.signal
        );

        setAbortController(null);
    };

    const handleStop = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
            setLoading(false);
            setMessages((prev) =>
                prev.map((m) =>
                    m.loading ? { ...m, loading: false } : m
                )
            );
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div
                className="px-4 sm:px-6 py-3 border-b flex items-center justify-between flex-shrink-0"
                style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
                <div className="flex items-center gap-2">
                    <Sparkles size={18} style={{ color: "var(--primary)" }} />
                    <h1 className="font-semibold text-sm sm:text-base" style={{ color: "var(--foreground)" }}>
                        DocuQuery Chat
                    </h1>
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
                {messages.length === 0 ? (
                    <EmptyState onSuggestion={handleSend} />
                ) : (
                    <AnimatePresence>
                        {messages.map((msg) => (
                            <MessageBubble key={msg.id} message={msg} />
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Input */}
            <div 
                className="px-4 sm:px-6 pb-4 pt-2 flex-shrink-0"
                data-input-focused={isInputFocused}
            >
                <div
                    className="flex items-end gap-2 rounded-xl border px-4 py-3 transition-all focus-within:ring-2"
                    style={{
                        background: "var(--card)",
                        borderColor: "var(--border)",
                        ["--tw-ring-color" as string]: "var(--ring)",
                    }}
                >
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        onFocus={() => {
                            setIsInputFocused(true);
                            document.body.classList.add('chat-input-focused');
                        }}
                        onBlur={() => {
                            setIsInputFocused(false);
                            document.body.classList.remove('chat-input-focused');
                        }}
                        placeholder="Ask a question about your documents..."
                        className="flex-1 py-1 bg-transparent outline-none text-sm resize-none max-h-32"
                        rows={1}
                        style={{ color: "var(--foreground)" }}
                        disabled={loading && !abortController}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = "auto";
                            target.style.height = `${target.scrollHeight}px`;
                        }}
                    />
                    <div className="flex items-center gap-2 mb-1">
                        {loading && abortController ? (
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={handleStop}
                                className="p-2 rounded-lg transition-colors"
                                style={{ background: "var(--danger)", color: "white" }}
                                title="Stop generation"
                            >
                                <Square size={16} fill="white" />
                            </motion.button>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleSend()}
                                disabled={loading || !input.trim()}
                                className="p-2 rounded-lg transition-colors disabled:opacity-30"
                                style={{ background: "var(--primary)", color: "white" }}
                            >
                                <Send size={16} />
                            </motion.button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Empty State ────────────────────────────────────────────────

function EmptyState({ onSuggestion }: { onSuggestion: (q: string) => void }) {
    return (
        <div className="h-full flex flex-col items-center justify-center">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 animate-pulse-glow"
                style={{ background: "var(--primary)" }}
            >
                <Sparkles size={28} color="white" />
            </motion.div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                What would you like to know?
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>
                Ask questions about your uploaded documents
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                {SUGGESTIONS.map((s, i) => (
                    <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * i }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        onClick={() => onSuggestion(s)}
                        className="text-left px-4 py-3 rounded-xl border text-sm transition-all"
                        style={{
                            background: "var(--card)",
                            borderColor: "var(--border)",
                            color: "var(--foreground)",
                        }}
                    >
                        <Search size={14} className="inline mr-2" style={{ color: "var(--primary)" }} />
                        {s}
                    </motion.button>
                ))}
            </div>
        </div>
    );
}

// ── Message Bubble ─────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
    const [showSources, setShowSources] = useState(false);
    const isUser = message.role === "user";

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
        >
            {/* Avatar */}
            <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                    background: isUser ? "var(--accent)" : "var(--primary)",
                }}
            >
                {isUser ? <User size={16} color="white" /> : <Sparkles size={16} color="white" />}
            </div>

            {/* Content */}
            <div className="max-w-2xl">
                <div
                    className="rounded-2xl px-4 py-3 text-sm leading-relaxed text-left"
                    style={{
                        background: isUser ? "var(--primary)" : "var(--card)",
                        color: isUser ? "white" : "var(--foreground)",
                        border: isUser ? "none" : "1px solid var(--border)",
                    }}
                >
                    {message.loading ? (
                        <div className="flex gap-1 py-1">
                            <span className="w-2 h-2 rounded-full typing-dot" style={{ background: "var(--primary)" }} />
                            <span className="w-2 h-2 rounded-full typing-dot" style={{ background: "var(--primary)" }} />
                            <span className="w-2 h-2 rounded-full typing-dot" style={{ background: "var(--primary)" }} />
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                </div>

                {/* Metadata badges */}
                {message.metadata && !message.loading && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {message.metadata.cache_hit && (
                            <span
                                className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                                style={{ background: "rgba(34,197,94,0.1)", color: "var(--success)" }}
                            >
                                <Zap size={10} /> Cached
                            </span>
                        )}
                        <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
                        >
                            {message.metadata.after_reranking} sources used
                        </span>
                    </div>
                )}

                {/* Sources */}
                {message.sources && message.sources.length > 0 && !message.loading && (
                    <div className="mt-2">
                        <button
                            onClick={() => setShowSources(!showSources)}
                            className="flex items-center gap-1 text-xs font-medium transition-colors"
                            style={{ color: "var(--primary)" }}
                        >
                            <BookOpen size={12} />
                            {message.sources.length} source(s)
                            {showSources ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>

                        <AnimatePresence>
                            {showSources && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-2 space-y-2"
                                >
                                    {message.sources.map((src) => (
                                        <SourceCard key={src.citation_index} source={src} />
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// ── Source Card ─────────────────────────────────────────────────

function SourceCard({ source }: { source: SourceCitation }) {
    return (
        <div
            className="rounded-lg p-3 border text-xs"
            style={{
                background: "var(--secondary)",
                borderColor: "var(--border)",
            }}
        >
            <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium flex items-center gap-1" style={{ color: "var(--foreground)" }}>
                    <FileText size={12} style={{ color: "var(--primary)" }} />
                    [{source.citation_index}] {source.document_name}
                    {source.page_number && (
                        <span style={{ color: "var(--muted-foreground)" }}> · p.{source.page_number}</span>
                    )}
                </span>
                <div className="flex gap-2">
                    <span
                        className="px-1.5 py-0.5 rounded text-xs"
                        style={{
                            background:
                                source.relevance_score >= 0.7
                                    ? "rgba(34,197,94,0.15)"
                                    : "rgba(245,158,11,0.15)",
                            color: source.relevance_score >= 0.7 ? "var(--success)" : "var(--warning)",
                        }}
                    >
                        Relevance: {(source.relevance_score * 100).toFixed(0)}%
                    </span>
                </div>
            </div>
            <p style={{ color: "var(--muted-foreground)" }} className="leading-relaxed">
                {source.chunk_snippet}
            </p>
            <p className="mt-1.5 italic" style={{ color: "var(--primary)" }}>
                {source.relevance_justification}
            </p>
        </div>
    );
}
