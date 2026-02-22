const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
    private getToken(): string | null {
        if (typeof window === "undefined") return null;
        const token = localStorage.getItem("access_token");
        if (token && this.isTokenExpired(token)) {
            localStorage.removeItem("access_token");
            return null;
        }
        return token;
    }

    private isTokenExpired(token: string): boolean {
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            return payload.exp * 1000 < Date.now();
        } catch (e) {
            return true;
        }
    }

    public isAuthenticated(): boolean {
        return !!this.getToken();
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const token = this.getToken();
        const headers: Record<string, string> = {
            ...(options.headers as Record<string, string>),
        };

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        if (!(options.body instanceof FormData)) {
            headers["Content-Type"] = "application/json";
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: "Request failed" }));
            throw new Error(error.detail || `HTTP ${response.status}`);
        }

        return response.json();
    }

    // Auth
    async signup(email: string, password: string, fullName?: string) {
        return this.request<AuthResponse>("/auth/signup", {
            method: "POST",
            body: JSON.stringify({ email, password, full_name: fullName }),
        });
    }

    async login(email: string, password: string) {
        return this.request<AuthResponse>("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
    }

    async getMe() {
        return this.request<Profile>("/auth/me");
    }

    // Documents
    async uploadDocument(file: File) {
        const formData = new FormData();
        formData.append("file", file);
        return this.request<DocumentUpload>("/documents/upload", {
            method: "POST",
            body: formData,
        });
    }

    async uploadDocumentsBulk(files: File[]) {
        const formData = new FormData();
        files.forEach((f) => formData.append("files", f));
        return this.request<DocumentUpload[]>("/documents/upload-bulk", {
            method: "POST",
            body: formData,
        });
    }

    async listDocuments() {
        return this.request<DocumentList>("/documents/");
    }

    async getDocument(id: string) {
        return this.request<Document>(`/documents/${id}`);
    }

    async getDocumentProgress(id: string) {
        return this.request<DocumentProgress>(`/documents/${id}/progress`);
    }

    async deleteDocument(id: string) {
        return this.request<{ message: string }>(`/documents/${id}`, {
            method: "DELETE",
        });
    }

    // Q&A
    async askQuestion(question: string, documentIds?: string[]) {
        return this.request<QAResponse>("/qa/ask", {
            method: "POST",
            body: JSON.stringify({ question, document_ids: documentIds }),
        });
    }

    async askQuestionStream(
        question: string,
        documentIds: string[] | undefined,
        conversationId: string | undefined,
        callbacks: {
            onToken: (token: string) => void;
            onSources: (sources: SourceCitation[]) => void;
            onMetadata: (metadata: RetrievalMetadata) => void;
            onDone: () => void;
            onError: (error: string) => void;
        },
        signal?: AbortSignal
    ) {
        const token = this.getToken();
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        try {
            const response = await fetch(`${API_BASE}/qa/ask/stream`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    question,
                    document_ids: documentIds,
                    conversation_id: conversationId
                }),
                signal
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: "Request failed" }));
                callbacks.onError(error.detail || `HTTP ${response.status}`);
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) {
                callbacks.onError("No response body");
                return;
            }

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse complete SSE events from the buffer
                const events = buffer.split("\n\n");
                buffer = events.pop() || ""; // Keep incomplete event in buffer

                for (const event of events) {
                    if (!event.trim()) continue;

                    const lines = event.split("\n");
                    let eventType = "";
                    let data = "";

                    for (const line of lines) {
                        if (line.startsWith("event: ")) eventType = line.slice(7);
                        else if (line.startsWith("data: ")) data = line.slice(6);
                    }

                    if (eventType === "token" && data) {
                        callbacks.onToken(JSON.parse(data));
                    } else if (eventType === "sources" && data) {
                        callbacks.onSources(JSON.parse(data));
                    } else if (eventType === "metadata" && data) {
                        callbacks.onMetadata(JSON.parse(data));
                    } else if (eventType === "done") {
                        callbacks.onDone();
                    }
                }
            }
        } catch (err) {
            callbacks.onError(err instanceof Error ? err.message : "Stream failed");
        }
    }

    // Conversations
    async listConversations() {
        return this.request<Conversation[]>("/qa/conversations");
    }

    async getConversationMessages(id: string) {
        return this.request<ChatMessage[]>(`/qa/conversations/${id}/messages`);
    }

    async deleteConversation(id: string) {
        return this.request<{ status: string }>(`/qa/conversations/${id}`, {
            method: "DELETE",
        });
    }
}

// Types
export interface AuthResponse {
    user_id: string | null;
    email: string | null;
    access_token: string | null;
    refresh_token: string | null;
}

export interface Profile {
    id: string;
    full_name: string | null;
    created_at: string;
}

export interface DocumentUpload {
    id: string;
    file_name: string;
    status: string;
    message: string;
}

export interface Document {
    id: string;
    file_name: string;
    file_size: number | null;
    status: string;
    indexing_progress: number;
    total_chunks: number;
    created_at: string;
}

export interface DocumentList {
    documents: Document[];
    total: number;
}

export interface DocumentProgress {
    id: string;
    status: string;
    indexing_progress: number;
}

export interface SourceCitation {
    citation_index: number;
    document_name: string;
    document_id: string;
    page_number: number | null;
    chunk_snippet: string;
    vector_similarity_score: number;
    relevance_score: number;
    relevance_justification: string;
}

export interface RetrievalMetadata {
    total_candidates: number;
    after_reranking: number;
    model_used: string;
    cache_hit: boolean;
    conversation_id?: string;
    message_id?: string;
}

export interface QAResponse {
    answer: string;
    sources: SourceCitation[];
    retrieval_metadata: RetrievalMetadata;
    conversation_id: string;
    message_id: string;
}

export interface ChatMessage {
    id: string;
    conversation_id: string;
    role: "user" | "assistant";
    content: string;
    sources?: SourceCitation[];
    metadata?: any;
    created_at: string;
}

export interface Conversation {
    id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

export const api = new ApiClient();
