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
        setSessionId(parsed.session_id || "");
      } catch {}
    } catch (e: any) {
      setError(e?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-20 max-w-md">
      <Card className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Register</h1>
        {error && <div className="text-destructive text-sm">{error}</div>}
        <Input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button onClick={onSubmit} disabled={loading}>
          {loading ? "Submitting..." : "Register"}
        </Button>
        {sessionId && (
          <div className="text-xs text-muted-foreground">
            Session: {sessionId}
          </div>
        )}
      </Card>
    </div>
  );
}
