"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import ForgotPassword from "../../components/ForgotPassword";
import { useAuth } from "../../context/AuthContext";
import { useUser } from "../../context/UserContext";
import Image from "next/image";
import ErrorModal from "@/app/components/ErrorModal";
import SuccessModal from "@/app/components/SuccessModal";
import RestoreAccountModal from "@/app/components/RestoreAccountModal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restorePending, setRestorePending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const router = useRouter();
  const { login } = useAuth();
  const { fetchUserData } = useUser();

  const openForgotPasswordModal = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setIsForgotPasswordOpen(true);
  };

  const closeForgotPasswordModal = () => {
    setIsForgotPasswordOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }
      );
      const data = await response.json();

      if (response.status === 409) {
        setIsRestoreModalOpen(true);
        return;
      }

      if (data.success) {
        login(data.data.access_token);
        await fetchUserData();
        setSuccessMessage("Logged in successfully!");
        setShowSuccessModal(true);
      } else {
        setErrorMessage(data.detail || "Login failed.");
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error("Login error:", error);
      setErrorMessage("An error occurred while logging in. Please try again.");
      setShowErrorModal(true);
    }
  };

  const handleRestoreAccount = async () => {
    setRestorePending(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/restore-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }
      );
      const data = await response.json();

      if (data.success) {
        login(data.data.access_token);
        await fetchUserData();
        setSuccessMessage("Account restored successfully!");
        setShowSuccessModal(true);
      } else {
        setErrorMessage(data.detail || "Failed to restore account.");
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error("Restore error:", error);
      setErrorMessage("An error occurred while restoring the account.");
      setShowErrorModal(true);
    } finally {
      setRestorePending(false);
      setIsRestoreModalOpen(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/google/login`
      );
      const data = await response.json();

      if (data.success && data.data?.google_auth_url) {
        window.location.href = data.data.google_auth_url;
      } else {
        throw new Error("Failed to retrieve Google login URL.");
      }
    } catch (error) {
      console.error("Google login error:", error);
      setErrorMessage("Google login failed. Please try again.");
      setShowErrorModal(true);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    router.push("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Welcome back! Please enter your details
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="johndoe@gmail.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <a
                href="#"
                onClick={openForgotPasswordModal}
                className="text-sm font-medium text-primary hover:underline"
              >
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-background px-2 text-muted-foreground">
              or continue with
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleLogin}
          className="w-full"
        >
          <Image
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            width={20}
            height={20}
            className="mr-2"
          />
          Sign in with Google
        </Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-primary hover:underline"
          >
            Sign up
          </Link>
        </p>
      </Card>

      <ForgotPassword
        isOpen={isForgotPasswordOpen}
        onClose={closeForgotPasswordModal}
      />

      <RestoreAccountModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        onRestore={handleRestoreAccount}
        isRestoring={restorePending}
      />

      <ErrorModal
        show={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        message={errorMessage}
      />
      <SuccessModal
        show={showSuccessModal}
        onClose={handleSuccessClose}
        message={successMessage}
      />
    </div>
  );
}
