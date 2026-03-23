"use server";

import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

type InvokeResult<T> = {
  data: T | null;
  error: string | null;
};

type InvokeOptions = {
  accessToken?: string;
};

function looksLikeJwt(token?: string | null): token is string {
  return typeof token === "string" && token.split(".").length === 3;
}

function getProjectFunctionJwt(): { token: string; source: string } | null {
  const directFunctionJwt = process.env.SUPABASE_FUNCTIONS_JWT?.trim();
  if (looksLikeJwt(directFunctionJwt)) {
    return {
      token: directFunctionJwt,
      source: "SUPABASE_FUNCTIONS_JWT",
    };
  }

  const fallbackAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (looksLikeJwt(fallbackAnonKey)) {
    return {
      token: fallbackAnonKey,
      source: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    };
  }

  return null;
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context;
    const status = response.status;
    let details = "";

    try {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const payload = await response.clone().json();
        details =
          (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "") ||
          (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "") ||
          JSON.stringify(payload);
      } else {
        details = await response.clone().text();
      }
    } catch {
      // Keep the generic message if the response body cannot be parsed.
    }

    return details ? `${error.message} (${status}): ${details}` : `${error.message} (${status})`;
  }

  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError || error instanceof Error) {
    return error.message;
  }

  return "Beklenmeyen bir hata olustu";
}

export async function invokeSupabaseFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  options?: InvokeOptions
): Promise<InvokeResult<T>> {
  const projectFunctionJwt = getProjectFunctionJwt();
  const providedAccessToken = options?.accessToken?.trim();
  let accessToken = projectFunctionJwt?.token || providedAccessToken;
  const tokenSource = projectFunctionJwt
    ? `project_jwt:${projectFunctionJwt.source}`
    : providedAccessToken
      ? "provided"
      : "session";

  if (!accessToken && !projectFunctionJwt) {
    const supabase = await createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      return {
        data: null,
        error: `Aktif oturum okunamadi: ${sessionError.message}`,
      };
    }

    accessToken = session?.access_token;
  }

  if (!accessToken) {
    return {
      data: null,
      error: "Mail function cagrisi icin aktif oturum bulunamadi",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(tokenSource.startsWith("project_jwt:") ? { apikey: accessToken } : {}),
    },
  });

  if (error) {
    return {
      data: null,
      error: await getFunctionErrorMessage(error),
    };
  }

  return {
    data: data as T,
    error: null,
  };
}
