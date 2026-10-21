import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../services/apiClient";
import { useAuth } from "../../context/AuthContext";
import type { AuthResponse, SafeUser } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { UserPlus, CheckCircle2 } from "lucide-react";

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
}

export function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{
    message: string;
    code?: string;
    details?: { path: string; message: string }[];
  } | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Validate form fields client-side
  const validate = (): boolean => {
    const errors: FieldErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      errors.name = "Full name is required.";
    } else if (trimmedName.length > 255) {
      errors.name = "Full name cannot exceed 255 characters.";
    }

    if (!trimmedEmail) {
      errors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address.";
    } else if (trimmedEmail.length > 255) {
      errors.email = "Email address cannot exceed 255 characters.";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters long.";
    } else if (password.length > 128) {
      errors.password = "Password cannot exceed 128 characters.";
    }

    if (phone && phone.trim().length > 50) {
      errors.phone = "Phone number cannot exceed 50 characters.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Prevent duplicate in-flight submissions
    if (isLoading) return;

    setError(null);

    // Run client-side validation
    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      // 1. Submit to backend /auth/register
      // Note: Backend registerSchema enforces customer role creation for public accounts
      await api.post<{ user: SafeUser }>("/auth/register", {
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() ? phone.trim() : undefined,
      });

      // 2. Immediately log in to obtain JWT session token
      const loginRes = await api.post<AuthResponse>("/auth/login", {
        email: email.trim(),
        password,
      });

      // 3. Update centralized auth state
      login(loginRes.token, loginRes.user);

      // 4. Redirect newly registered customer to the business directory
      navigate("/businesses", { replace: true });
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === "EMAIL_ALREADY_EXISTS" || err.status === 409) {
          setError({
            code: "EMAIL_ALREADY_EXISTS",
            message:
              "An account with this email address already exists. Please sign in or use a different email.",
          });
          setFieldErrors((prev) => ({
            ...prev,
            email: "This email address is already in use.",
          }));
        } else if (err.code === "VALIDATION_ERROR" && err.details) {
          setError({
            code: "VALIDATION_ERROR",
            message: "Please correct the highlighted errors.",
            details: err.details,
          });
          // Map backend validation errors to field-level errors
          const mappedErrors: FieldErrors = {};
          err.details.forEach((d) => {
            if (d.path === "name") mappedErrors.name = d.message;
            if (d.path === "email") mappedErrors.email = d.message;
            if (d.path === "password") mappedErrors.password = d.message;
            if (d.path === "phone") mappedErrors.phone = d.message;
          });
          setFieldErrors(mappedErrors);
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
            "Unable to connect to the server. Please check your network and try again.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-10">
      <Card
        title="Create your Account"
        subtitle="Register as a client to discover businesses and book appointments"
        className="shadow-sm"
      >
        {error && (
          <Alert
            type="error"
            title={error.code === "EMAIL_ALREADY_EXISTS" ? "Email Conflict" : undefined}
            message={error.message}
            details={error.details}
            className="mb-4"
          />
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Full Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-xs font-semibold text-[#18181B] mb-1.5"
            >
              Full Name <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              disabled={isLoading}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) {
                  setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              placeholder="e.g. Bisrat Girma"
              className={`w-full px-3.5 py-2 border rounded-lg text-sm text-[#18181B] bg-white placeholder-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#111111] transition-all disabled:opacity-50 disabled:bg-[#FAFAF8] ${
                fieldErrors.name
                  ? "border-[#DC2626] focus:ring-[#DC2626]"
                  : "border-[#E7E7E4]"
              }`}
            />
            {fieldErrors.name && (
              <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Email Address */}
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

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-[#18181B] mb-1.5"
            >
              Password <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              disabled={isLoading}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              placeholder="Min. 8 characters"
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

          {/* Phone Number */}
          <div>
            <label
              htmlFor="phone"
              className="block text-xs font-semibold text-[#18181B] mb-1.5"
            >
              Phone Number{" "}
              <span className="text-xs font-normal text-[#6B6B6B]">
                (Optional)
              </span>
            </label>
            <input
              id="phone"
              type="tel"
              disabled={isLoading}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (fieldErrors.phone) {
                  setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                }
              }}
              placeholder="+251 91 123 4567"
              className={`w-full px-3.5 py-2 border rounded-lg text-sm text-[#18181B] bg-white placeholder-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#111111] transition-all disabled:opacity-50 disabled:bg-[#FAFAF8] ${
                fieldErrors.phone
                  ? "border-[#DC2626] focus:ring-[#DC2626]"
                  : "border-[#E7E7E4]"
              }`}
            />
            {fieldErrors.phone && (
              <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                {fieldErrors.phone}
              </p>
            )}
          </div>

          {/* Policy Note on Customer Role */}
          <div className="p-3 bg-[#FAFAF8] border border-[#E7E7E4] rounded-lg flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0 mt-0.5" />
            <p className="text-xs text-[#6B6B6B] leading-relaxed">
              Standard customer accounts book services in any business timezone. Service providers can register their business tenant directly after sign in.
            </p>
          </div>

          <Button
            type="submit"
            isLoading={isLoading}
            variant="primary"
            className="w-full mt-2"
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            Create Customer Account
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#E7E7E4] text-center text-xs text-[#6B6B6B]">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-[#18181B] hover:underline"
          >
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
