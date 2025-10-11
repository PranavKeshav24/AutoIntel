"use client";

import { useEffect, useState, useRef, Fragment } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { useUser } from "@/app/context/UserContext";
import ErrorModal from "@/app/components/ErrorModal";
import SuccessModal from "@/app/components/SuccessModal";

export default function GoogleRedirectPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { fetchUserData } = useUser();

  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restorePending, setRestorePending] = useState(false);
  const [restoreEmail, setRestoreEmail] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const hasHandled = useRef(false);

  useEffect(() => {
    if (hasHandled.current) return;

    const url = new URL(window.location.href);
    const success = url.searchParams.get("success");
    const token = url.searchParams.get("access_token");
    const email = url.searchParams.get("email");

    if (success === "true" && token) {
      hasHandled.current = true;
      login(token);
      fetchUserData();
      setSuccessMessage("Login successful! Redirecting...");
      setShowSuccessModal(true);
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } else if (success === "false" && email) {
      hasHandled.current = true;
      setRestoreEmail(email);
      setIsRestoreModalOpen(true);
    } else {
      hasHandled.current = true;
      setErrorMessage("Google login failed.");
      setShowErrorModal(true);
    }
  }, [login, fetchUserData, router]);

  const handleRestoreAccount = async () => {
    setRestorePending(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/restore-account/google`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: restoreEmail }),
        }
      );

      const data = await res.json();
      if (data.success) {
        login(data.data.access_token);
        await fetchUserData();
        setSuccessMessage("Account restored successfully! Redirecting...");
        setShowSuccessModal(true);
        setIsRestoreModalOpen(false);
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } else {
        setIsRestoreModalOpen(false);
        setErrorMessage(data.detail || "Failed to restore account.");
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error("Error restoring account:", error);
      setIsRestoreModalOpen(false);
      setErrorMessage("An error occurred while restoring your account.");
      setShowErrorModal(true);
    } finally {
      setRestorePending(false);
    }
  };

  return (
    <>
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg font-semibold text-gray-700">
            {restorePending
              ? "Restoring your account..."
              : "Completing your login..."}
          </div>
          <div className="text-gray-500">
            Please wait while we redirect you.
          </div>
        </div>
      </div>

      {/* Restore Modal */}
      <Transition appear show={isRestoreModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-10"
          onClose={() => setIsRestoreModalOpen(false)}
        >
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Restore Deleted Account
                  </DialogTitle>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      This account is scheduled for deletion. Do you want to
                      restore it?
                    </p>
                  </div>

                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 cursor-pointer"
                      onClick={() => setIsRestoreModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 cursor-pointer"
                      onClick={handleRestoreAccount}
                      disabled={restorePending}
                    >
                      {restorePending ? "Restoring..." : "Restore"}
                    </button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Error Modal */}
      <ErrorModal
        show={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        message={errorMessage}
      />

      {/* Success Modal */}
      <SuccessModal
        show={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          router.push("/");
        }}
        message={successMessage}
      />
    </>
  );
}
