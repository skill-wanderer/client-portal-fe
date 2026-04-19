import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

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

  return (
    <Container className="flex flex-col items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Sign in
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to access the client portal.
          </p>
        </div>
        {errorMessage && (
          <div className="rounded-md bg-red-50 p-3 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {errorMessage}
          </div>
        )}
        <Link href="/api/auth/login" className="block">
          <Button className="w-full" type="button">
            Continue with SSO
          </Button>
        </Link>
      </div>
    </Container>
  );
}
