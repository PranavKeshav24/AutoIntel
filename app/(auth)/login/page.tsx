"use client";

import Link from "next/link";
import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import ForgotPassword from "../../components/ForgotPassword";
import { useAuth } from "../../context/AuthContext";
import { useUser } from "../../context/UserContext";
import Image from "next/image";
import ErrorModal from "@/app/components/ErrorModal";
import SuccessModal from "@/app/components/SuccessModal";
import RestoreAccountModal from "@/app/components/RestoreAccountModal";

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
    <>
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl/9 font-bold tracking-tight text-gray-900">
          Sign in to your account
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm/6 font-medium text-gray-900"
            >
              Email address
            </label>
            <div className="mt-2">
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="johndoe@gmail.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-md border border-input px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm/6 font-medium text-gray-900"
              >
                Password
              </label>
              <div className="text-sm">
                <a
                  href="#"
                  onClick={openForgotPasswordModal}
                  className="font-semibold text-indigo-600 hover:text-indigo-500"
                >
                  Forgot password?
                </a>
              </div>
            </div>

            <div className="mt-2 relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md border border-input px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center cursor-pointer text-gray-600 bg-transparent border-none p-0"
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

          <div>
            <button
              type="submit"
              className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 cursor-pointer"
            >
              Sign in
            </button>
          </div>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm/6">
            <span className="bg-white px-2 text-gray-500">
              or continue with
            </span>
          </div>
        </div>

        <div>
          <button
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm/6 font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition cursor-pointer"
          >
            <Image
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google"
              width={20}
              height={20}
            />
            Sign in with Google
          </button>
        </div>

        <p className="mt-10 text-center text-sm/6 text-gray-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Sign up
          </Link>
        </p>
      </div>

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
    </>
  );
}
