"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, {
  useRef,
  useState,
  useEffect,
  KeyboardEvent,
  ClipboardEvent,
  JSX,
} from "react";
import SuccessModal from "@/app/components/SuccessModal";
import ErrorModal from "@/app/components/ErrorModal";

export default function VerifyOtp(): JSX.Element {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [resendTimer, setResendTimer] = useState<number>(20);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [showErrorModal, setShowErrorModal] = useState<boolean>(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("sessionId");

  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendTimer > 0) {
      timer = setTimeout(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const handleChange = (element: HTMLInputElement, index: number): void => {
    if (isNaN(Number(element.value))) return;

    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);

    if (element.value !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    element: HTMLInputElement,
    event: KeyboardEvent<HTMLInputElement>,
    index: number
  ): void => {
    if (event.key === "Backspace" && element.value === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>): void => {
    const pasteData = e.clipboardData.getData("text").trim();
    if (!/^\d{1,6}$/.test(pasteData)) {
      e.preventDefault();
      return;
    }

    const newOtp: string[] = Array(6).fill("");
    for (let i = 0; i < pasteData.length && i < 6; i++) {
      newOtp[i] = pasteData[i];
    }
    setOtp(newOtp);
    inputRefs.current[Math.min(pasteData.length - 1, 5)]?.focus();
    e.preventDefault();
  };

  const handleVerify = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    setError("");

    const fullOtp = otp.join("");

    if (fullOtp.length !== 6) {
      setError("Please enter a 6-digit OTP.");
      setShowErrorModal(true);
      return;
    }

    if (!sessionId || typeof sessionId !== "string") {
      setError("Session ID not found in URL.");
      setShowErrorModal(true);
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/verify/otp`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: String(sessionId),
            otp: String(fullOtp),
          }),
        }
      );

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(data.message || "OTP Verified!");
        setShowSuccessModal(true);
        setTimeout(() => {
          setShowSuccessModal(false);
          router.push("/login");
        }, 2000);
      } else {
        throw new Error(data.detail || "OTP verification failed");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
      setShowErrorModal(true);
    }
  };

  const handleResendOtp = async (
    e: React.MouseEvent<HTMLAnchorElement>
  ): Promise<void> => {
    e.preventDefault();
    if (resendTimer > 0 || !sessionId) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/resend-otp?session_id=${sessionId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await res.json();
      if (data.success) {
        setResendTimer(20);
      } else {
        throw new Error(data.detail || "Failed to resend OTP");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP.");
      setShowErrorModal(true);
    }
  };

  return (
    <>
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="text-center text-2xl/9 font-bold tracking-tight text-gray-900">
          Verify OTP
        </h2>
        <p className="mt-2 text-center text-sm/6 text-gray-500">
          Enter the 6-digit code sent to your email.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-8" onSubmit={handleVerify}>
          <div className="flex justify-center space-x-2">
            {otp.map((value, index) => (
              <input
                key={`otp-input-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={value}
                onChange={(e) => handleChange(e.target, index)}
                onKeyDown={(e) => handleKeyDown(e.currentTarget, e, index)}
                onPaste={handlePaste}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                className="w-12 h-12 text-center text-2xl font-bold text-gray-900 rounded-md border border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 outline-none transition-all duration-200 ease-in-out focus:ring-2 focus:ring-offset-2"
                autoComplete="off"
              />
            ))}
          </div>

          <div>
            <button
              type="submit"
              className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 cursor-pointer"
            >
              Verify
            </button>
          </div>

          <p className="text-center text-sm/6 text-gray-500">
            Didn&apos;t receive the code?{" "}
            <a
              href="#"
              onClick={handleResendOtp}
              className={`font-semibold ${
                resendTimer > 0
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-indigo-600 hover:text-indigo-500"
              }`}
            >
              {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : "Resend OTP"}
            </a>
          </p>
        </form>
      </div>

      {/* Modals */}
      <ErrorModal
        show={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        message={error}
      />

      <SuccessModal
        show={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        message={successMessage}
      />
    </>
  );
}
