import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api, ApiError } from "../../services/apiClient";
import type { AuthResponse } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { LogIn } from "lucide-react";

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{
    message: string;
    code?: string;
    details?: { path: string; message: string }[];
  } | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Retrieve destination if redirected from a protected route
  const from = (location.state as any)?.from?.pathname;

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Prevent duplicate submissions
    if (isLoading) return;

    setError(null);

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.post<AuthResponse>("/auth/login", {
        email: email.trim(),
        password,
      });

      // Update auth context & token storage
      login(res.token, res.user);

      // Route based on role or intended destination
      if (res.user.role === "platform_admin") {
        navigate("/admin", { replace: true });
      } else if (res.user.role === "business_owner") {
        navigate("/owner", { replace: true });
      } else {
        // Customer role: return to intended page if one was saved, else directory
        navigate(from || "/businesses", { replace: true });
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === 401 || err.code === "INVALID_CREDENTIALS") {
          setError({
            code: "INVALID_CREDENTIALS",
            message:
              "Invalid email or password. Please verify your credentials and try again.",
          });
        } else if (err.code === "VALIDATION_ERROR" && err.details) {
          setError({
            code: "VALIDATION_ERROR",
            message: "Validation failed. Please verify the input values.",
            details: err.details,
          });
        } else {
          setError({
            code: err.code,
            message: err.message,
            details: err.details,
          });
        }
      } else {
        setError({
          message:
            "Unable to connect to the authentication server. Please check your network and try again.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-12">
      <Card
        title="Sign in to Goom"
        subtitle="Access your bookings, schedule, or business workspace"
        className="shadow-sm"
      >
        {error && (
          <Alert
            type="error"
            title={
              error.code === "INVALID_CREDENTIALS"
                ? "Authentication Failed"
                : undefined
            }
            message={error.message}
            details={error.details}
            className="mb-4"
          />
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-[#18181B] mb-1.5"
            >
              Email Address <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              disabled={isLoading}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              placeholder="you@example.com"
              className={`w-full px-3.5 py-2 border rounded-lg text-sm text-[#18181B] bg-white placeholder-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#111111] transition-all disabled:opacity-50 disabled:bg-[#FAFAF8] ${
                fieldErrors.email
                  ? "border-[#DC2626] focus:ring-[#DC2626]"
                  : "border-[#E7E7E4]"
              }`}
            />
            {fieldErrors.email && (
              <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-[#18181B]"
              >
                Password <span className="text-[#DC2626]">*</span>
              </label>
            </div>
            <input
              id="password"
              type="password"
              required
              disabled={isLoading}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              placeholder="••••••••••••"
              className={`w-full px-3.5 py-2 border rounded-lg text-sm text-[#18181B] bg-white placeholder-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#111111] transition-all disabled:opacity-50 disabled:bg-[#FAFAF8] ${
                fieldErrors.password
                  ? "border-[#DC2626] focus:ring-[#DC2626]"
                  : "border-[#E7E7E4]"
              }`}
            />
            {fieldErrors.password && (
              <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <Button
            type="submit"
            isLoading={isLoading}
            variant="primary"
            className="w-full mt-2"
            leftIcon={<LogIn className="h-4 w-4" />}
          >
            Sign In
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#E7E7E4] text-center text-xs text-[#6B6B6B]">
          Don't have an account yet?{" "}
          <Link
            to="/register"
            className="font-semibold text-[#18181B] hover:underline"
          >
            Create an account
          </Link>
        </div>
      </Card>
    </div>
  );
}
