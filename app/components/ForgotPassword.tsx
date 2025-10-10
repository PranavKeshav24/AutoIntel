"use client";

import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import ErrorModal from "./ErrorModal";
import SuccessModal from "./SuccessModal";

interface ForgotPasswordProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ForgotPassword({
  isOpen,
  onClose,
}: ForgotPasswordProps) {
  const [email, setEmail] = useState("");
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [sessionId, setSessionId] = useState("");

  const handleSubmit = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/forgot-password/${email}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json();

      if (data.success) {
        localStorage.setItem("reset_email", email);
        setSessionId(data.data.session_id);
        setSuccessMessage("OTP sent successfully! Please check your email.");
        setIsSuccessModalOpen(true);
        onClose();
      } else {
        onClose();
        setErrorMessage(data.detail || "Failed to send OTP.");
        setIsErrorModalOpen(true);
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      onClose();
      setErrorMessage("Failed to send OTP. Please try again later.");
      setIsErrorModalOpen(true);
    }
  };

  const handleSuccessClose = () => {
    setIsSuccessModalOpen(false);
    window.location.href = `/reset-password?sessionId=${sessionId}`;
  };

  return (
    <>
      <Dialog open={isOpen} onClose={onClose} className="relative z-10">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
        />

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              transition
              className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-lg data-closed:sm:translate-y-0 data-closed:sm:scale-95"
            >
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 sm:mx-0 sm:size-10">
                    <ArrowPathIcon
                      aria-hidden="true"
                      className="size-6 text-indigo-600"
                    />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <DialogTitle
                      as="h3"
                      className="text-xl font-semibold text-gray-900"
                    >
                      Reset Your Password
                    </DialogTitle>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Enter your email address below and we&apos;ll send you
                        an OTP to reset your password.
                      </p>
                      <div className="mt-4">
                        <label htmlFor="email-reset" className="sr-only">
                          Email address
                        </label>
                        <input
                          id="email-reset"
                          name="email-reset"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
                          placeholder="johndoe@gmail.com"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 sm:ml-3 sm:w-auto cursor-pointer"
                >
                  Send OTP
                </button>
                <button
                  type="button"
                  data-autofocus
                  onClick={onClose}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* Error Modal */}
      <ErrorModal
        show={isErrorModalOpen}
        onClose={() => setIsErrorModalOpen(false)}
        message={errorMessage}
      />

      {/* Success Modal */}
      <SuccessModal
        show={isSuccessModalOpen}
        onClose={handleSuccessClose}
        message={successMessage}
      />
    </>
  );
}
