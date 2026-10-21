import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Compass, Home } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="max-w-lg mx-auto py-16">
      <EmptyState
        icon={<Compass className="h-8 w-8 stroke-[1.5] text-[#2563EB]" />}
        title="404 — Page Not Found"
        description="The resource, route, or tenant workspace you are trying to reach does not exist or has been relocated."
        action={
          <Link to="/">
            <Button variant="primary" leftIcon={<Home className="h-4 w-4" />}>
              Return to Homepage
            </Button>
          </Link>
        }
      />
    </div>
  );
}
