// ==============================================================================
// VERDIX — Frontend API Client & Service Layer
// Clean abstraction layer to query Verdix Cloud API with Bearer token authentication.
// ==============================================================================

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      sessionStorage.setItem("verdix_auth_token", token);
    } else {
      sessionStorage.removeItem("verdix_auth_token");
    }
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== "undefined") {
    authToken = sessionStorage.getItem("verdix_auth_token");
  }
  return authToken;
}

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export interface User {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiDataset {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  sourceType: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  createdAt: string;
  updatedAt: string;
  organization?: {
    id: string;
    name: string;
  };
}

export interface ApiEvaluationResult {
  id: string;
  evaluationId: string;
  completenessScore: number;
  consistencyScore: number;
  duplicateRate: number;
  anomalyCount: number;
  invalidValueCount: number;
  missingValueRate: number;
  biasIndicator: number;
  privacyStatus: "ENFORCED" | "BLOCKED" | "REVIEW_REQUIRED";
  rawRecordsTransferred: number;
  processingTimeMs: number;
  createdAt: string;
  healthScore?: number;
  detailedMetrics?: any;
}

export interface ApiEvaluation {
  id: string;
  organizationId: string;
  datasetId: string;
  name: string;
  description?: string | null;
  status: "PENDING" | "READY" | "RUNNING" | "COMPLETED" | "FAILED" | "CREATED" | "QUEUED";
  evaluationType: "DATA_QUALITY" | "ANOMALY" | "BIAS" | "FULL";
  checks?: string[];
  createdBy?: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  dataset?: {
    id: string;
    name: string;
    sourceType?: string;
    status?: string;
  };
  results?: ApiEvaluationResult[];
}

export interface ApiPrivacyPolicy {
  id: string;
  organizationId: string;
  name: string;
  allowAggregates: boolean;
  allowQualityScores: boolean;
  allowMissingRates: boolean;
  allowAnomalyCounts: boolean;
  allowBiasIndicators: boolean;
  allowIndividualRecords: boolean;
  allowRawDataset: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEvaluationPayload {
  datasetId: string;
  name: string;
  description?: string;
  checks: string[];
  evaluationType?: "DATA_QUALITY" | "ANOMALY" | "BIAS" | "FULL";
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error(err.error || "Login failed");
  }

  const data: AuthResponse = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function registerUser(payload: {
  organizationName: string;
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Registration failed" }));
    throw new Error(err.error || "Registration failed");
  }

  const data: AuthResponse = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function getCurrentUser(): Promise<User | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.user || null;
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: "POST",
      headers: getHeaders(),
    });
  } finally {
    setAuthToken(null);
  }
}

export async function getDatasets(): Promise<ApiDataset[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/datasets`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch datasets: ${res.statusText}`);
    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error("API client error in getDatasets:", error);
    return [];
  }
}

export async function getEvaluations(): Promise<ApiEvaluation[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/evaluations`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch evaluations: ${res.statusText}`);
    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error("API client error in getEvaluations:", error);
    return [];
  }
}

export async function getEvaluation(id: string): Promise<ApiEvaluation | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/evaluations/${id}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch evaluation ${id}: ${res.statusText}`);
    const json = await res.json();
    return json.data || null;
  } catch (error) {
    console.error(`API client error in getEvaluation(${id}):`, error);
    return null;
  }
}

export async function getPrivacyPolicies(): Promise<ApiPrivacyPolicy[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/privacy/policies`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch privacy policies: ${res.statusText}`);
    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error("API client error in getPrivacyPolicies:", error);
    return [];
  }
}

export async function createEvaluation(
  payload: CreateEvaluationPayload
): Promise<ApiEvaluation> {
  const res = await fetch(`${API_BASE_URL}/api/v1/evaluations`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to create evaluation" }));
    throw new Error(err.message || err.error || "Failed to create evaluation");
  }
  const json = await res.json();
  return json.data;
}

export async function runEvaluation(id: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/v1/evaluations/${id}/run`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to dispatch evaluation" }));
    throw new Error(err.message || err.error || "Failed to dispatch evaluation");
  }
  return res.json();
}
