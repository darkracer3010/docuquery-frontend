const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
    private getToken(): string | null {
        if (typeof window === "undefined") return null;
        return localStorage.getItem("access_token");
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

export interface QAResponse {
    answer: string;
    sources: SourceCitation[];
    retrieval_metadata: {
        total_candidates: number;
        after_reranking: number;
        model_used: string;
        cache_hit: boolean;
    };
}

export const api = new ApiClient();
