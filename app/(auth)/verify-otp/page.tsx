import { Suspense } from "react";
import VerifyOtp from "./VerifyOtp";

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyOtp />
    </Suspense>
  );
}
