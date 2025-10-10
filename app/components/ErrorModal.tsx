import React from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/solid";

type ErrorModalProps = {
  show: boolean;
  onClose: () => void;
  message: string;
};

export default function ErrorModal({
  show,
  onClose,
  message,
}: ErrorModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-8 text-center shadow-lg">
        <ExclamationCircleIcon className="mx-auto h-12 w-12 text-red-600 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">{message}</h2>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 cursor-pointer"
        >
          OK
        </button>
      </div>
    </div>
  );
}
