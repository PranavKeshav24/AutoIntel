"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { registerUser } from "@/lib/api";

export default function RegisterPage() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string>("");
  const [sessionId, setSessionId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await registerUser({ name, email, password });
      try {
        const parsed = JSON.parse(res as unknown as string);
        const sid = parsed.session_id || "";
        setSessionId(sid);
        if (sid) {
          window.location.href = `/verify-otp?session_id=${encodeURIComponent(sid)}`;
        }
      } catch {}
    } catch (e: any) {
      setError(e?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-20 max-w-md">
      <Card className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        {error && <div className="text-destructive text-sm">{error}</div>}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Name</label>
          <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Email</label>
          <Input placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Password</label>
          <Input placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button onClick={onSubmit} disabled={loading} className="w-full">{loading ? "Submitting..." : "Register"}</Button>
        {sessionId && (
          <div className="text-xs text-muted-foreground text-center">
            Session: {sessionId}
          </div>
        )}
        <div className="text-sm text-muted-foreground text-center">
          Already have an account? <a className="underline" href="/login">Login</a>
        </div>
      </Card>
    </div>
  );
}
