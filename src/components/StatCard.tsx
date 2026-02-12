import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  href?: string;
}

export function StatCard({ label, value, subValue, icon, trend, href }: StatCardProps) {
  const content = (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-foreground/50 text-sm mb-1 font-medium">{label}</p>
        <p className="text-2xl md:text-3xl font-bold text-foreground">{value}</p>
        {subValue && (
          <p
            className={`text-sm mt-1 font-medium ${
              trend === "up"
                ? "text-mint-dark"
                : trend === "down"
                ? "text-claw"
                : "text-foreground/50"
            }`}
          >
            {trend === "up" && "↑ "}
            {trend === "down" && "↓ "}
            {subValue}
          </p>
        )}
      </div>
      {icon && <div className="text-primary/60">{icon}</div>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="card-kawaii p-6 hover:scale-105 transition-all cursor-pointer block">
        {content}
      </Link>
    );
  }

  return (
    <div className="card-kawaii p-6 hover:scale-105 transition-all">
      {content}
    </div>
  );
}
