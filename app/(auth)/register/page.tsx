"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import ErrorModal from "@/app/components/ErrorModal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [error, setError] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== repeatPassword) {
      setError("Passwords do not match.");
      setShowErrorModal(true);
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, email, password }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.detail || "Something went wrong");
      }

      const sessionId = data.data.session_id;

      if (!sessionId) {
        throw new Error("No session ID received");
      }

      router.push(`/verify-otp?sessionId=${sessionId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setShowErrorModal(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-24">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Create an account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign up to get started with your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="johndoe@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
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

          <div className="space-y-2">
            <Label htmlFor="repeatPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="repeatPassword"
                name="repeatPassword"
                type={showRepeatPassword ? "text" : "password"}
                required
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={
                  showRepeatPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
              >
                {showRepeatPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full">
            Sign up
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </Card>

      <ErrorModal
        show={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        message={error}
      />
    </div>
  );
}
