import { useEffect, useState, useCallback, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../services/apiClient";
import type { SafeService, CreateServicePayload, UpdateServicePayload } from "../../types/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonCard } from "../../components/ui/Skeleton";
import {
  ArrowLeft,
  Briefcase,
  Plus,
  Edit2,
  CheckCircle2,
  X,
  RotateCw,
  Power,
} from "lucide-react";

interface FormState {
  name: string;
  description: string;
  price: string;
  duration_minutes: number;
}

const defaultForm: FormState = {
  name: "",
  description: "",
  price: "",
  duration_minutes: 30,
};

export function OwnerServicesPage() {
  const [services, setServices] = useState<SafeService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<SafeService | null>(null);
  const [formData, setFormData] = useState<FormState>(defaultForm);
  const [formErrors, setFormErrors] = useState<{ name?: string; price?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.get<{ services: SafeService[] }>("/businesses/me/services");
      setServices(res?.services || []);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load business services. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const openCreateModal = () => {
    setEditingService(null);
    setFormData(defaultForm);
    setFormErrors({});
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (svc: SafeService) => {
    setEditingService(svc);
    setFormData({
      name: svc.name,
      description: svc.description || "",
      price: String(svc.price),
      duration_minutes: svc.durationMinutes,
    });
    setFormErrors({});
    setModalError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
    setFormData(defaultForm);
    setFormErrors({});
    setModalError(null);
  };

  const validateForm = (): boolean => {
    const errors: { name?: string; price?: string } = {};

    if (!formData.name.trim()) {
      errors.name = "Service name is required.";
    } else if (formData.name.trim().length > 255) {
      errors.name = "Service name cannot exceed 255 characters.";
    }

    const priceNum = Number(formData.price);
    if (!formData.price.trim()) {
      errors.price = "Price is required.";
    } else if (isNaN(priceNum) || priceNum < 0) {
      errors.price = "Price must be a valid non-negative number.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) return;

    setIsSubmitting(true);
    setModalError(null);

    try {
      if (editingService) {
        // Edit existing service
        const payload: UpdateServicePayload = {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          price: Number(formData.price),
          duration_minutes: 30,
        };

        await api.patch(`/businesses/me/services/${editingService.id}`, payload);
        setSuccessMessage(`Service "${formData.name.trim()}" was updated successfully.`);
      } else {
        // Create new service
        const payload: CreateServicePayload = {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          price: Number(formData.price),
          duration_minutes: 30,
          is_active: true,
        };

        await api.post("/businesses/me/services", payload);
        setSuccessMessage(`Service "${formData.name.trim()}" was created successfully.`);
      }

      closeModal();
      await loadServices();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setModalError(err.message || "Operation failed.");
      } else {
        setModalError("A network error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (svc: SafeService) => {
    const actionText = svc.isActive ? "deactivate" : "reactivate";
    const confirmPrompt = window.confirm(
      `Are you sure you want to ${actionText} "${svc.name}"? ${
        svc.isActive
          ? "Clients will no longer be able to select or book this service."
          : "Clients will be able to book this service again."
      }`
    );
    if (!confirmPrompt) return;

    try {
      if (svc.isActive) {
        // Soft-deactivate via DELETE
        await api.delete(`/businesses/me/services/${svc.id}`);
        setSuccessMessage(`Service "${svc.name}" was deactivated.`);
      } else {
        // Reactivate via PATCH
        await api.patch(`/businesses/me/services/${svc.id}`, { is_active: true });
        setSuccessMessage(`Service "${svc.name}" was reactivated.`);
      }
      await loadServices();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update service active status.");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/owner"
              className="text-xs text-[#6B6B6B] hover:text-[#18181B] inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Dashboard</span>
            </Link>
            <span className="text-xs text-[#6B6B6B]">/</span>
            <span className="text-xs font-semibold text-[#18181B]">Services</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
            Service Offerings
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
            Manage your catalog of fixed 30-minute bookable appointments and pricing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadServices}
            leftIcon={<RotateCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={openCreateModal}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add Service
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}
      {successMessage && (
        <Alert
          type="success"
          message={successMessage}
          className="transition-all"
        />
      )}

      {/* Services List */}
      <Card
        title="Services Catalog"
        subtitle="Configured offerings with strict 30-minute availability slot binding"
        headerAction={
          <span className="text-xs text-[#6B6B6B] font-mono">
            {services.length} Total Registered
          </span>
        }
      >
        {isLoading ? (
          <div className="space-y-3 py-2">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        ) : services.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-6 w-6 stroke-[1.5]" />}
            title="No services configured"
            description="You have not created any service offerings yet. Add your first service to start accepting online appointment bookings."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={openCreateModal}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Add Your First Service
              </Button>
            }
            className="border-0 bg-transparent py-8"
          />
        ) : (
          <div className="divide-y divide-[#E7E7E4]">
            {services.map((svc) => (
              <div
                key={svc.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-sm text-[#18181B] truncate">
                      {svc.name}
                    </h4>
                    <StatusBadge
                      status={svc.isActive ? "active" : "inactive"}
                      label={svc.isActive ? "Active" : "Deactivated"}
                      size="sm"
                    />
                    <span className="text-[11px] font-mono text-[#6B6B6B] px-1.5 py-0.5 rounded bg-[#FAFAF8] border border-[#E7E7E4]">
                      {svc.durationMinutes} min
                    </span>
                  </div>

                  {svc.description && (
                    <p className="text-xs text-[#6B6B6B] leading-relaxed max-w-xl">
                      {svc.description}
                    </p>
                  )}

                  {!svc.isActive && (
                    <p className="text-[11px] text-[#D97706] font-medium">
                      Deactivated: hidden from customer availability and booking engine.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0 self-end sm:self-center">
                  <div className="text-right">
                    <div className="text-xs text-[#6B6B6B]">Price</div>
                    <div className="text-sm font-bold font-mono text-[#18181B]">
                      {svc.price} ETB
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditModal(svc)}
                      leftIcon={<Edit2 className="h-3.5 w-3.5" />}
                    >
                      Edit
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(svc)}
                      leftIcon={<Power className="h-3.5 w-3.5" />}
                      className={
                        svc.isActive
                          ? "text-[#DC2626] hover:bg-[#FEE2E2] hover:border-[#FECACA]"
                          : "text-[#16A34A] hover:bg-[#DCFCE7] hover:border-[#BBF7D0]"
                      }
                      title={svc.isActive ? "Deactivate service" : "Reactivate service"}
                    >
                      {svc.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal Dialog for Add / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-xl border border-[#E7E7E4] shadow-2xl p-6 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E7E4]">
              <h3 className="font-semibold text-sm text-[#18181B]">
                {editingService ? "Edit Service Offering" : "Create New Service"}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded text-[#6B6B6B] hover:text-[#18181B]"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalError && <Alert type="error" message={modalError} className="mt-3" />}

            <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="svc-name"
                  className="block text-xs font-semibold text-[#18181B] mb-1.5"
                >
                  Service Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="svc-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, name: e.target.value }));
                    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder="e.g. General Consultation"
                  className={`w-full px-3.5 py-2 border rounded-lg text-sm text-[#18181B] bg-white placeholder-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#111111] ${
                    formErrors.name ? "border-[#DC2626] focus:ring-[#DC2626]" : "border-[#E7E7E4]"
                  }`}
                />
                {formErrors.name && (
                  <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                    {formErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="svc-desc"
                  className="block text-xs font-semibold text-[#18181B] mb-1.5"
                >
                  Description{" "}
                  <span className="text-xs font-normal text-[#6B6B6B]">(Optional)</span>
                </label>
                <textarea
                  id="svc-desc"
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Provide a brief summary of what this appointment covers..."
                  className="w-full px-3.5 py-2 border border-[#E7E7E4] rounded-lg text-xs text-[#18181B] bg-white placeholder-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#111111]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="svc-price"
                    className="block text-xs font-semibold text-[#18181B] mb-1.5"
                  >
                    Price (ETB) <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    id="svc-price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, price: e.target.value }));
                      if (formErrors.price) setFormErrors((prev) => ({ ...prev, price: undefined }));
                    }}
                    placeholder="e.g. 500"
                    className={`w-full px-3.5 py-2 border rounded-lg text-sm text-[#18181B] bg-white placeholder-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#111111] font-mono ${
                      formErrors.price ? "border-[#DC2626] focus:ring-[#DC2626]" : "border-[#E7E7E4]"
                    }`}
                  />
                  {formErrors.price && (
                    <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                      {formErrors.price}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="svc-duration"
                    className="block text-xs font-semibold text-[#18181B] mb-1.5"
                  >
                    Duration (Minutes)
                  </label>
                  <input
                    id="svc-duration"
                    type="number"
                    disabled
                    value={30}
                    className="w-full px-3.5 py-2 border border-[#E7E7E4] rounded-lg text-sm text-[#6B6B6B] bg-[#FAFAF8] font-mono cursor-not-allowed"
                  />
                  <p className="text-[10px] text-[#6B6B6B] mt-1">
                    Fixed 30-min slot unit in V1.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7E7E4]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSubmitting}
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                >
                  {editingService ? "Save Changes" : "Create Service"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
