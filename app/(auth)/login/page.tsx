import { LoginPageClient } from "@/components/login/login-page-client";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Login session expired. Please try again.",
  auth_failed: "Authentication failed. Please try again.",
  session_expired: "Your session has expired. Please sign in again.",
  service_unavailable: "Service temporarily unavailable. Please try again later.",
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : null;

  return <LoginPageClient errorMessage={errorMessage} hasErrorParam={Boolean(error)} />;
}
