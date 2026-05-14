import { LoginPageClient } from "@/components/login/login-page-client";
import { getLoginErrorMessage } from "@/lib/portal-runtime";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const errorMessage = getLoginErrorMessage(error);

  return <LoginPageClient errorMessage={errorMessage} hasErrorParam={Boolean(error)} />;
}
