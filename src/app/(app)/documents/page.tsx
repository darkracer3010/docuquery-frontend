"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Upload,
    FileText,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Clock,
    MessageSquare,
    CloudUpload,
    File,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { api, type Document } from "@/lib/api";

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
    uploaded: { color: "var(--warning)", icon: Clock, label: "Uploaded" },
    processing: { color: "var(--primary)", icon: Loader2, label: "Processing" },
    ready: { color: "var(--success)", icon: CheckCircle2, label: "Ready" },
    failed: { color: "var(--danger)", icon: AlertCircle, label: "Failed" },
};

const SUPPORTED_TYPES = [
    ".pdf", ".docx", ".xlsx", ".xls", ".csv", ".json", ".md", ".markdown", ".txt",
];

export default function DashboardPage() {
    const router = useRouter();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [processingDocs, setProcessingDocs] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const hasFetched = useRef(false);

    const fetchDocuments = useCallback(async () => {
        try {
            const result = await api.listDocuments();
            setDocuments(result.documents);

            // Identify docs that need progress tracking
            const active = result.documents
                .filter(d => d.status === "processing" || d.status === "uploaded")
                .map(d => d.id);
            setProcessingDocs(new Set(active));
        } catch {
            console.error("Failed to fetch documents");
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch documents only once on mount (ref guard handles React Strict Mode double-mount)
    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;
        fetchDocuments();
    }, [fetchDocuments]);

    // Polling individual document progress via GET /{id}/progress
    useEffect(() => {
        if (processingDocs.size === 0) return;

        const pollProgress = async () => {
            const currentIds = Array.from(processingDocs);
            for (const docId of currentIds) {
                // Skip if document was removed from UI state already (e.g. by handleDelete)
                if (!documents.some(d => d.id === docId)) {
                    setProcessingDocs(prev => {
                        const next = new Set(prev);
                        next.delete(docId);
                        return next;
                    });
                    continue;
                }

                try {
                    const progress = await api.getDocumentProgress(docId);

                    // Update the local state for this document
                    setDocuments(prev => prev.map(d =>
                        d.id === docId
                            ? { ...d, status: progress.status, indexing_progress: progress.indexing_progress }
                            : d
                    ));

                    // If it's done or failed, remove from processing set
                    if (progress.status === "ready" || progress.status === "failed") {
                        setProcessingDocs(prev => {
                            const next = new Set(prev);
                            next.delete(docId);
                            return next;
                        });
                        // Sync final fields (total_chunks etc.) for this specific doc
                        try {
                            const fullDoc = await api.getDocument(docId);
                            setDocuments(prev => prev.map(d =>
                                d.id === docId ? fullDoc : d
                            ));
                        } catch {
                            // ignore — we already have the status updated
                        }
                    }
                } catch (err: any) {
                    // If 404, the document is gone, stop polling
                    if (err.message?.includes("404") || err.status === 404) {
                        setProcessingDocs(prev => {
                            const next = new Set(prev);
                            next.delete(docId);
                            return next;
                        });
                    }
                    console.error(`Failed to poll progress for ${docId}:`, err);
                }
            }
        };

        const interval = setInterval(pollProgress, 1500);
        return () => clearInterval(interval);
    }, [processingDocs, documents]);

    const handleUpload = async (files: FileList | File[]) => {
        setUploading(true);
        try {
            for (const file of Array.from(files)) {
                const doc = await api.uploadDocument(file);
                // Add the document to the list immediately so the progress bar is visible
                setDocuments(prev => [{
                    id: doc.id,
                    file_name: doc.file_name,
                    file_size: file.size,
                    status: "uploaded",
                    indexing_progress: 0,
                    total_chunks: 0,
                    created_at: new Date().toISOString(),
                }, ...prev]);
                // Start tracking progress for this document
                setProcessingDocs(prev => new Set(prev).add(doc.id));
            }
        } catch (err) {
            console.error("Upload failed:", err);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        // Optimistically update UI and stop polling
        setProcessingDocs(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        setDocuments((prev) => prev.filter((d) => d.id !== id));

        try {
            await api.deleteDocument(id);
        } catch (err) {
            console.error("Delete failed:", err);
            // Revert on error? For now just log, document is likely already gone or error is unrecoverable
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) {
            handleUpload(e.dataTransfer.files);
        }
    };

    const formatSize = (bytes: number | null) => {
        if (!bytes) return "—";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    Documents
                </h1>
                <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                    Upload and manage your documents for AI-powered Q&A
                </p>
            </div>

            {/* Upload Zone */}
            <motion.div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                whileHover={{ scale: 1.01 }}
                className="border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all"
                style={{
                    borderColor: dragOver ? "var(--primary)" : "var(--border)",
                    background: dragOver ? "rgba(99,102,241,0.05)" : "var(--card)",
                }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={SUPPORTED_TYPES.join(",")}
                    onChange={(e) => e.target.files && handleUpload(e.target.files)}
                    className="hidden"
                />
                <motion.div
                    animate={dragOver ? { y: -4, scale: 1.1 } : { y: 0, scale: 1 }}
                >
                    {uploading ? (
                        <Loader2 size={40} className="mx-auto animate-spin" style={{ color: "var(--primary)" }} />
                    ) : (
                        <CloudUpload size={40} className="mx-auto" style={{ color: "var(--primary)" }} />
                    )}
                </motion.div>
                <p className="mt-3 font-medium" style={{ color: "var(--foreground)" }}>
                    {uploading ? "Uploading..." : "Drop files here or click to upload"}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                    PDF, DOCX, Excel, CSV, JSON, Markdown, Text
                </p>
            </motion.div>

            {/* Document List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={24} className="animate-spin" style={{ color: "var(--primary)" }} />
                </div>
            ) : documents.length === 0 ? (
                <div className="text-center py-16">
                    <FileText size={48} className="mx-auto mb-3" style={{ color: "var(--muted-foreground)" }} />
                    <p style={{ color: "var(--muted-foreground)" }}>No documents yet. Upload your first file above!</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <AnimatePresence>
                        {documents.map((doc, idx) => {
                            const status = statusConfig[doc.status] || statusConfig.uploaded;
                            const StatusIcon = status.icon;

                            return (
                                <motion.div
                                    key={doc.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="rounded-xl p-4 flex items-center gap-4 border transition-all hover:border-opacity-60"
                                    style={{
                                        background: "var(--card)",
                                        borderColor: "var(--border)",
                                    }}
                                >
                                    {/* File icon */}
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: "var(--secondary)" }}
                                    >
                                        <File size={20} style={{ color: "var(--primary)" }} />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate" style={{ color: "var(--foreground)" }}>
                                            {doc.file_name}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                                                {formatSize(doc.file_size)}
                                            </span>
                                            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                                                {formatDate(doc.created_at)}
                                            </span>
                                            {doc.total_chunks > 0 && (
                                                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                                                    {doc.total_chunks} chunks
                                                </span>
                                            )}
                                        </div>

                                        {/* Progress bar for processing/uploaded */}
                                        {(doc.status === "processing" || doc.status === "uploaded") && (
                                            <div
                                                className="h-1.5 rounded-full mt-2 overflow-hidden border border-white/5"
                                                style={{ background: "var(--secondary)" }}
                                                title={`Progress: ${doc.indexing_progress}%`}
                                            >
                                                <motion.div
                                                    className="h-full rounded-full"
                                                    style={{ background: "var(--primary)" }}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${Math.max(doc.indexing_progress, 2)}%` }} // Show at least 2% for visibility
                                                    transition={{ duration: 0.5 }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Status */}
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                                        style={{ background: `${status.color}15`, color: status.color }}
                                    >
                                        <StatusIcon
                                            size={14}
                                            className={(doc.status === "processing" || doc.status === "uploaded") ? "animate-spin" : ""}
                                        />
                                        {status.label}
                                        {(doc.status === "processing" || doc.status === "uploaded") && ` ${doc.indexing_progress}%`}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-1">
                                        {doc.status === "ready" && (
                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={() => router.push(`/chat?doc=${doc.id}`)}
                                                className="p-2 rounded-lg transition-colors"
                                                style={{ color: "var(--primary)" }}
                                                title="Chat about this document"
                                            >
                                                <MessageSquare size={16} />
                                            </motion.button>
                                        )}
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => handleDelete(doc.id)}
                                            className="p-2 rounded-lg transition-colors"
                                            style={{ color: "var(--danger)" }}
                                            title="Delete document"
                                        >
                                            <Trash2 size={16} />
                                        </motion.button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
