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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Verify OTP</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the 6-digit code sent to your email
          </p>
        </div>

        <form className="space-y-8" onSubmit={handleVerify}>
          <div className="flex justify-center gap-2">
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
                className="w-12 h-14 text-center text-2xl font-bold rounded-md border border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 outline-none transition-all"
                autoComplete="off"
              />
            ))}
          </div>

          <Button type="submit" className="w-full">
            Verify OTP
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Didn&apos;t receive the code?{" "}
            <a
              href="#"
              onClick={handleResendOtp}
              className={`font-medium ${
                resendTimer > 0
                  ? "text-muted-foreground cursor-not-allowed"
                  : "text-primary hover:underline"
              }`}
            >
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
            </a>
          </p>
        </form>
      </Card>

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
    </div>
  );
}
